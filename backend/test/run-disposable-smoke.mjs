import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { admitSmoke, withSmokeCleanup } from './smoke-ownership.mjs';

assert.equal(process.env.CI, 'true');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.GITHUB_JOB, 'maintenance-smoke');
for (const key of ['GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT'])
  assert.match(process.env[key] ?? '', /^[1-9]\d*$/);
const token = randomBytes(16).toString('hex');
const project = `hms-smoke-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-${token}`;
const cwd = fileURLToPath(new URL('..', import.meta.url));
const artifact = fileURLToPath(
  new URL(`../smoke-artifacts/${token}/`, import.meta.url),
);
mkdirSync(artifact, { recursive: true });
const env = {
  ...process.env,
  HMS_SMOKE_TOKEN: token,
  HMS_SMOKE_PROJECT: project,
  HMS_SMOKE_STARTED: new Date().toISOString(),
  NODE_ENV: 'test',
  NOTIFICATIONS_ENABLED: 'false',
};
for (const key of Object.keys(env))
  if (/^(FIREBASE_|GOOGLE_|GMAIL_|MAIL_|BREVO_|VNPAY_|S3_|AWS_)/.test(key))
    env[key] = '';
for (const key of [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GMAIL_USER',
  'BREVO_API_KEY',
  'VNPAY_TMN_CODE',
  'VNPAY_HASH_SECRET',
  'VNPAY_PAYMENT_URL',
  'VNPAY_RETURN_URL',
  'VNPAY_IPN_URL',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
])
  env[key] = '';
for (const key of [
  'UC36_API_URL',
  'UC55_API_URL',
  'UC56_API_URL',
  'DASHBOARD_API_URL',
  'OPERATIONAL_API_URL',
  'NODE_OPTIONS',
])
  delete env[key];
const docker = (args) =>
  execFileSync('docker', args, { cwd, env, encoding: 'utf8' }).trim();
const compose = (args) =>
  docker([
    'compose',
    '--project-name',
    project,
    '--file',
    'test/compose.smoke.yml',
    ...args,
  ]);
for (const kind of ['container', 'volume', 'network']) {
  assert.equal(
    docker([
      kind,
      'ls',
      '--quiet',
      '--filter',
      `label=com.docker.compose.project=${project}`,
    ]),
    '',
    'Refusing an existing project',
  );
}
await withSmokeCleanup(
  env,
  docker,
  async () => {
    const owned = [];
    compose(['up', '--build', '--detach', '--wait', '--wait-timeout', '180']);
    const ids = ['mongo', 'backend', 'frontend'].map((service) =>
      compose(['ps', '--quiet', service]),
    );
    const containers = JSON.parse(docker(['inspect', ...ids]));
    for (let i = 0; i < ids.length; i++) {
      const c = containers[i];
      assert.match(c.Id, /^[a-f0-9]{64}$/);
      assert.equal(c.Config.Labels['com.docker.compose.project'], project);
      assert.equal(c.Config.Labels['hms.smoke.token'], token);
      assert.ok(Date.parse(c.Created) >= Date.parse(env.HMS_SMOKE_STARTED));
      owned.push(c.Id);
    }
    const binding = (c, port) => {
      const bindings = c.NetworkSettings.Ports[port];
      assert.equal(bindings.length, 1);
      assert.equal(bindings[0].HostIp, '127.0.0.1');
      assert.ok(Number(bindings[0].HostPort) >= 1024);
      assert.notEqual(bindings[0].HostPort, '27017');
      return bindings[0].HostPort;
    };
    Object.assign(env, {
      HMS_SMOKE_MONGO_ID: containers[0].Id,
      HMS_SMOKE_BACKEND_ID: containers[1].Id,
      MONGODB_URI: `mongodb://127.0.0.1:${binding(containers[0], '27017/tcp')}/hms_reporting_smoke_test`,
      HMS_SMOKE_API: `http://127.0.0.1:${binding(containers[1], '3000/tcp')}`,
      UC36_SNAPSHOT: `${artifact}/maintenance-before.json`,
    });
    admitSmoke(env);
    writeFileSync(
      `${artifact}/ownership.json`,
      JSON.stringify(
        {
          project,
          token,
          started: env.HMS_SMOKE_STARTED,
          ids: owned,
          mongo: env.MONGODB_URI,
          api: env.HMS_SMOKE_API,
          tmpfs: containers[0].Mounts,
        },
        null,
        2,
      ),
    );
    const proxy = `http://127.0.0.1:${binding(containers[2], '5173/tcp')}`;
    for (const base of [env.HMS_SMOKE_API, proxy]) {
      let ready = false;
      for (let attempt = 0; attempt < 90; attempt++) {
        admitSmoke(env);
        try {
          if (
            (
              await fetch(`${base}/api/v1/health`, {
                signal: AbortSignal.timeout(2000),
                redirect: 'error',
              })
            ).ok
          ) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      assert.ok(ready, 'Owned API/proxy did not become healthy');
    }
    const commands = [
      ['--import', './test/smoke-seed-preload.mjs', 'dist/seed.main.js'],
      ['test/maintenance-history.smoke.mjs', 'snapshot'],
      ['--import', './test/smoke-seed-preload.mjs', 'dist/seed.main.js'],
      ['test/maintenance-history.smoke.mjs', 'verify'],
      ...[
        'task-supervision',
        'revenue-report',
        'manager-dashboard',
        'operational-report',
      ].map((name) => [`test/${name}.smoke.mjs`]),
    ];
    for (const [index, args] of commands.entries()) {
      admitSmoke(env);
      const result = spawnSync(process.execPath, args, {
        cwd,
        env,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
      });
      writeFileSync(
        `${artifact}/${index}.log`,
        (result.stdout ?? '') + (result.stderr ?? ''),
      );
      assert.equal(
        result.status,
        0,
        `Smoke command ${index} failed; inspect artifacts`,
      );
    }
    return { commands: commands.length, scripts: 5 };
  },
  (result) =>
    writeFileSync(`${artifact}/result.json`, JSON.stringify(result, null, 2)),
);
