import { readFileSync } from 'node:fs';
import { assertSmokeEvidence, admitSmoke } from './smoke-ownership.mjs';

const env = {
  CI: 'true',
  GITHUB_ACTIONS: 'true',
  GITHUB_JOB: 'maintenance-smoke',
  GITHUB_RUN_ID: '123',
  GITHUB_RUN_ATTEMPT: '1',
  HMS_SMOKE_TOKEN: 'a'.repeat(32),
  HMS_SMOKE_STARTED: new Date().toISOString(),
  HMS_SMOKE_PROJECT: `hms-smoke-123-1-${'a'.repeat(32)}`,
  MONGODB_URI: 'mongodb://127.0.0.1:49152/hms_reporting_smoke_test',
  HMS_SMOKE_API: 'http://127.0.0.1:49153',
  HMS_SMOKE_MONGO_ID: 'b'.repeat(64),
  HMS_SMOKE_BACKEND_ID: 'c'.repeat(64),
};
const container = (
  service: string,
  id: string,
  port: string,
  host: string,
) => ({
  Id: id,
  Created: env.HMS_SMOKE_STARTED,
  State: { Running: true },
  Config: {
    Image: service === 'mongo' ? 'mongo:8' : 'backend',
    Labels: {
      'com.docker.compose.project': env.HMS_SMOKE_PROJECT,
      'com.docker.compose.service': service,
      'hms.smoke.token': env.HMS_SMOKE_TOKEN,
    },
    Env:
      service === 'backend'
        ? [
            'MONGODB_URI=mongodb://mongo:27017/hms_reporting_smoke_test',
            'NOTIFICATIONS_ENABLED=false',
          ]
        : [],
  },
  Mounts:
    service === 'mongo'
      ? ['/data/db', '/data/configdb'].map((Destination) => ({
          Type: 'tmpfs',
          Destination,
        }))
      : [],
  NetworkSettings: {
    Ports: { [port]: [{ HostIp: '127.0.0.1', HostPort: host }] },
    Networks: { [`${env.HMS_SMOKE_PROJECT}_default`]: {} },
  },
});
const evidence = () => [
  container('mongo', env.HMS_SMOKE_MONGO_ID, '27017/tcp', '49152'),
  container('backend', env.HMS_SMOKE_BACKEND_ID, '3000/tcp', '49153'),
];

describe('standalone smoke admission', () => {
  it('accepts the fresh exact Mongo and API pair', () =>
    expect(() => assertSmokeEvidence(env, evidence())).not.toThrow());
  it.each([
    'CI',
    'GITHUB_ACTIONS',
    'GITHUB_JOB',
    'HMS_SMOKE_TOKEN',
    'HMS_SMOKE_PROJECT',
    'HMS_SMOKE_STARTED',
    'HMS_SMOKE_API',
    'HMS_SMOKE_MONGO_ID',
    'HMS_SMOKE_BACKEND_ID',
  ])('rejects missing %s before Docker or network', (key) => {
    const input: NodeJS.ProcessEnv = { ...env };
    delete input[key];
    const inspect = vi.fn();
    expect(() => admitSmoke(input, inspect)).toThrow();
    expect(inspect).not.toHaveBeenCalled();
  });
  it.each([
    'mongodb://localhost:27017/hms_test',
    'mongodb://127.0.0.1:27017/hms_reporting_smoke_test',
  ])('rejects shared endpoints', (uri) =>
    expect(() =>
      assertSmokeEvidence({ ...env, MONGODB_URI: uri }, evidence()),
    ).toThrow(),
  );
  it.each([
    'id',
    'port',
    'api',
    'project',
    'token',
    'mount',
    'created',
    'backend-uri',
    'notifications',
  ])('rejects mismatched %s', (field) => {
    const data = evidence();
    if (field === 'id') data[0].Id = 'd'.repeat(64);
    if (field === 'port')
      data[0].NetworkSettings.Ports['27017/tcp'][0].HostPort = '27017';
    if (field === 'api')
      data[1].NetworkSettings.Ports['3000/tcp'][0].HostPort = '3000';
    if (field === 'project')
      data[0].Config.Labels['com.docker.compose.project'] = 'other';
    if (field === 'token') data[1].Config.Labels['hms.smoke.token'] = 'other';
    if (field === 'mount') data[0].Mounts[0].Type = 'volume';
    if (field === 'created') data[0].Created = '2000-01-01T00:00:00Z';
    if (field === 'backend-uri')
      data[1].Config.Env[0] = 'MONGODB_URI=mongodb://shared:27017/hms_test';
    if (field === 'notifications')
      data[1].Config.Env[1] = 'NOTIFICATIONS_ENABLED=true';
    expect(() => assertSmokeEvidence(env, data)).toThrow();
  });
  it('rejects independent API overrides before inspection', () => {
    const inspect = vi.fn();
    expect(() =>
      admitSmoke({ ...env, UC55_API_URL: 'http://127.0.0.1:3000' }, inspect),
    ).toThrow();
    expect(inspect).not.toHaveBeenCalled();
  });
  it('restricts HTTP requests to the inspected API and refuses redirects', async () => {
    const network = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', network);
    try {
      const inspect = vi.fn(() => evidence());
      const admitted = admitSmoke(env, inspect);
      expect(() =>
        admitted.fetch('http://127.0.0.1:3000/api/v1/users'),
      ).toThrow();
      expect(network).not.toHaveBeenCalled();
      await admitted.fetch(`${env.HMS_SMOKE_API}/api/v1/health`, {
        method: 'GET',
      });
      expect(network).toHaveBeenCalledWith(
        `${env.HMS_SMOKE_API}/api/v1/health`,
        { method: 'GET', redirect: 'error' },
      );
      inspect.mockReturnValue([]);
      expect(() =>
        admitted.fetch(`${env.HMS_SMOKE_API}/api/v1/users`),
      ).toThrow();
      expect(network).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('guards seed before importing production entry and prohibits broad cleanup', () => {
    const runner = readFileSync(
      new URL('./run-disposable-smoke.mjs', import.meta.url),
      'utf8',
    );
    expect(runner.match(/smoke-seed-preload\.mjs/g)).toHaveLength(2);
    expect(runner).not.toMatch(/down|prune|--volumes/);
    const preload = readFileSync(
      new URL('./smoke-seed-preload.mjs', import.meta.url),
      'utf8',
    );
    expect(preload).toContain('admitSmoke()');
    expect(preload).toContain('this.options.dbName');
  });
  it('guards every standalone writer before mongoose.connect and removes API fallbacks', () => {
    for (const name of [
      'maintenance-history',
      'task-supervision',
      'revenue-report',
      'manager-dashboard',
      'operational-report',
    ]) {
      const source = readFileSync(
        new URL(`./${name}.smoke.mjs`, import.meta.url),
        'utf8',
      );
      expect(source.indexOf('admitSmoke()')).toBeGreaterThanOrEqual(0);
      expect(source).toContain('api: base, fetch');
      expect(source.indexOf('admitSmoke()')).toBeLessThan(
        source.indexOf('mongoose.connect('),
      );
      expect(source).not.toMatch(
        /process\.env\.(?:UC\d+|DASHBOARD|OPERATIONAL)_API_URL/,
      );
    }
  });
});
