import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

function identity(env) {
  assert.equal(env.CI, 'true');
  assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.GITHUB_JOB, 'maintenance-smoke');
  assert.match(env.GITHUB_RUN_ID ?? '', /^[1-9]\d*$/);
  assert.match(env.GITHUB_RUN_ATTEMPT ?? '', /^[1-9]\d*$/);
  assert.match(env.HMS_SMOKE_TOKEN ?? '', /^[a-f0-9]{32}$/);
  assert.equal(
    env.HMS_SMOKE_PROJECT,
    `hms-smoke-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}-${env.HMS_SMOKE_TOKEN}`,
  );
  const started = Date.parse(env.HMS_SMOKE_STARTED);
  assert.ok(
    Number.isFinite(started) &&
      started <= Date.now() &&
      Date.now() - started < 30 * 60 * 1000,
  );
  for (const key of ['HMS_SMOKE_MONGO_ID', 'HMS_SMOKE_BACKEND_ID'])
    assert.match(env[key] ?? '', /^[a-f0-9]{64}$/);
  assert.notEqual(env.HMS_SMOKE_MONGO_ID, env.HMS_SMOKE_BACKEND_ID);
  const mongo = new URL(env.MONGODB_URI);
  const api = new URL(env.HMS_SMOKE_API);
  for (const url of [mongo, api]) {
    assert.equal(url.hostname, '127.0.0.1');
    assert.ok(Number(url.port) >= 1024 && Number(url.port) <= 65535);
    assert.notEqual(url.port, '27017');
    assert.equal(url.username + url.password + url.search + url.hash, '');
  }
  assert.equal(mongo.protocol, 'mongodb:');
  assert.equal(mongo.pathname, '/hms_reporting_smoke_test');
  assert.equal(api.protocol, 'http:');
  assert.equal(api.pathname, '/');
  assert.equal(env.HMS_SMOKE_API, api.origin);
  assert.notEqual(mongo.port, api.port);
  for (const key of [
    'UC36_API_URL',
    'UC55_API_URL',
    'UC56_API_URL',
    'DASHBOARD_API_URL',
    'OPERATIONAL_API_URL',
  ])
    assert.ok(!env[key], 'Independent API overrides are forbidden');
  return { mongo, api, started };
}

export function assertSmokeEvidence(env, containers) {
  const { mongo, api, started } = identity(env);
  assert.equal(containers.length, 2);
  for (const [index, service, id, port, published] of [
    [0, 'mongo', env.HMS_SMOKE_MONGO_ID, '27017/tcp', mongo.port],
    [1, 'backend', env.HMS_SMOKE_BACKEND_ID, '3000/tcp', api.port],
  ]) {
    const container = containers[index];
    assert.equal(container.Id, id);
    assert.equal(container.State.Running, true);
    assert.ok(Date.parse(container.Created) >= started);
    const labels = container.Config.Labels;
    assert.equal(labels['com.docker.compose.project'], env.HMS_SMOKE_PROJECT);
    assert.equal(labels['com.docker.compose.service'], service);
    assert.equal(labels['hms.smoke.token'], env.HMS_SMOKE_TOKEN);
    const bindings = container.NetworkSettings.Ports[port];
    assert.equal(bindings?.length, 1);
    assert.deepEqual(bindings[0], { HostIp: '127.0.0.1', HostPort: published });
    assert.deepEqual(Object.keys(container.NetworkSettings.Networks), [
      `${env.HMS_SMOKE_PROJECT}_default`,
    ]);
  }
  assert.equal(containers[0].Config.Image, 'mongo:8');
  assert.equal(containers[0].Mounts.length, 2);
  assert.deepEqual(containers[0].Mounts.map((m) => m.Destination).sort(), [
    '/data/configdb',
    '/data/db',
  ]);
  assert.ok(containers[0].Mounts.every((m) => m.Type === 'tmpfs'));
  assert.equal(containers[1].Mounts.length, 0);
  const configuration = Object.fromEntries(
    containers[1].Config.Env.map((value) => {
      const separator = value.indexOf('=');
      return [value.slice(0, separator), value.slice(separator + 1)];
    }),
  );
  assert.equal(
    configuration.MONGODB_URI,
    'mongodb://mongo:27017/hms_reporting_smoke_test',
  );
  assert.equal(configuration.NOTIFICATIONS_ENABLED, 'false');
  for (const [key, value] of Object.entries(configuration))
    if (/^(FIREBASE_|GOOGLE_|GMAIL_|MAIL_|BREVO_|VNPAY_|S3_|AWS_)/.test(key))
      assert.equal(value, '', `External credential ${key} must be empty`);
  return { uri: env.MONGODB_URI, api: api.origin };
}

export function cleanupSmokeResources(env, docker) {
  const errors = [];
  const removed = [];
  const inventory = (kind) =>
    docker([
      kind,
      'ls',
      ...(kind === 'container' ? ['--all'] : []),
      '--quiet',
      '--filter',
      `label=com.docker.compose.project=${env.HMS_SMOKE_PROJECT}`,
    ])
      .split('\n')
      .filter(Boolean);
  try {
    assert.match(env.HMS_SMOKE_TOKEN ?? '', /^[a-f0-9]{32}$/);
    assert.match(
      env.HMS_SMOKE_PROJECT ?? '',
      /^hms-smoke-[1-9]\d*-[1-9]\d*-[a-f0-9]{32}$/,
    );
    assert.ok(env.HMS_SMOKE_PROJECT.endsWith(`-${env.HMS_SMOKE_TOKEN}`));
    assert.ok(Number.isFinite(Date.parse(env.HMS_SMOKE_STARTED)));
    for (const kind of ['container', 'network']) {
      for (const id of inventory(kind)) {
        try {
          const args =
            kind === 'container' ? ['inspect', id] : ['network', 'inspect', id];
          let resource;
          try {
            [resource] = JSON.parse(docker(args));
          } catch (error) {
            if (!inventory(kind).includes(id)) continue;
            throw error;
          }
          assert.match(resource.Id, /^[a-f0-9]{64}$/);
          assert.ok(resource.Id.startsWith(id));
          const labels =
            kind === 'container' ? resource.Config.Labels : resource.Labels;
          assert.equal(
            labels['com.docker.compose.project'],
            env.HMS_SMOKE_PROJECT,
          );
          assert.equal(labels['hms.smoke.token'], env.HMS_SMOKE_TOKEN);
          assert.ok(
            Date.parse(resource.Created) >= Date.parse(env.HMS_SMOKE_STARTED),
          );
          if (kind === 'network')
            assert.equal(Object.keys(resource.Containers ?? {}).length, 0);
          try {
            docker(
              kind === 'container'
                ? ['rm', '--force', resource.Id]
                : ['network', 'rm', resource.Id],
            );
          } catch (error) {
            if (inventory(kind).some((value) => resource.Id.startsWith(value)))
              throw error;
          }
          removed.push({ kind, id: resource.Id });
        } catch (error) {
          errors.push({ kind, id, error: error.message });
        }
      }
    }
    for (const kind of ['container', 'network', 'volume']) {
      const remaining = inventory(kind);
      if (remaining.length) errors.push({ kind, remaining });
    }
  } catch (error) {
    errors.push({ error: error.message });
  }
  return { status: errors.length ? 'blocked' : 'passed', removed, errors };
}

export async function withSmokeCleanup(env, docker, run, report) {
  let result;
  let failure;
  let cleanup;
  try {
    result = await run();
  } catch (error) {
    failure = error;
  } finally {
    cleanup = cleanupSmokeResources(env, docker);
  }
  report({
    ...result,
    status:
      cleanup.status === 'blocked' ? 'blocked' : failure ? 'failed' : 'passed',
    error: failure?.message,
    cleanup,
  });
  if (cleanup.status !== 'passed')
    throw new Error(
      'Smoke cleanup blocked; resources preserved where ownership or absence is unproven',
      { cause: failure },
    );
  if (failure) throw failure;
  return result;
}

export function admitSmoke(
  env = process.env,
  inspect = (ids) =>
    JSON.parse(
      execFileSync('docker', ['inspect', ...ids], { encoding: 'utf8' }),
    ),
) {
  identity(env);
  const admitted = assertSmokeEvidence(
    env,
    inspect([env.HMS_SMOKE_MONGO_ID, env.HMS_SMOKE_BACKEND_ID]),
  );
  return {
    ...admitted,
    fetch: (url, options = {}) => {
      assert.equal(new URL(url).origin, admitted.api);
      assertSmokeEvidence(
        env,
        inspect([env.HMS_SMOKE_MONGO_ID, env.HMS_SMOKE_BACKEND_ID]),
      );
      return globalThis.fetch(url, { ...options, redirect: 'error' });
    },
  };
}
