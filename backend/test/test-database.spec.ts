import { execFileSync } from 'node:child_process';
import mongoose from 'mongoose';
import { verifyTestDatabaseOwner } from './test-database-owner.js';
import {
  assertDisposableTestEnvironment,
  assertServiceOrderTestDatabase,
  assertTestDatabase,
  assertTestDatabaseTarget,
} from './test-database.js';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

const memory = {
  MONGODB_URI: 'mongodb://127.0.0.1:49152/hms_intake_memory_test',
  HMS_TEST_HARNESS: 'memory',
  HMS_TEST_URI: 'mongodb://127.0.0.1:49152/hms_intake_memory_test',
  HMS_TEST_OWNER_PID: '1234',
  HMS_TEST_PARENT_PID: '1233',
  HMS_TEST_TOKEN: 'b'.repeat(32),
  HMS_TEST_DBPATH: `C:/Temp/hms-pr106-${'b'.repeat(32)}`,
};
const ci = {
  MONGODB_URI: 'mongodb://127.0.0.1:49153/hms_ci_test',
  HMS_TEST_URI: 'mongodb://127.0.0.1:49153/hms_ci_test',
  HMS_TEST_HARNESS: 'github-service',
  HMS_TEST_SERVICE_ID: 'a'.repeat(64),
  HMS_TEST_SERVICE_PORT: '49153',
  CI: 'true',
  GITHUB_ACTIONS: 'true',
  GITHUB_JOB: 'backend',
  GITHUB_RUN_ID: '123456',
  GITHUB_RUN_ATTEMPT: '1',
};

describe('disposable database admission', () => {
  it.each([undefined, 'admin', 'hms', 'invoice_idempotency_unknown'])(
    'rejects a database outside the fixture namespace (%#)',
    (database) => {
      expect(() => assertTestDatabaseTarget(database)).toThrow();
    },
  );

  it.each([
    'hms_ci_test',
    'hms_uc52_ab123_test',
    `invoice_idempotency_${'a'.repeat(24)}`,
  ])('admits a fixture database (%#)', (database) =>
    expect(() => assertTestDatabaseTarget(database)).not.toThrow(),
  );

  it('blocks unit connections before any network operation', () => {
    const client = new mongoose.mongo.MongoClient(
      'mongodb://127.0.0.1:49152/hms_test',
    );
    expect(() => client.connect()).toThrow(
      'Database connections are forbidden',
    );
  });

  it('rejects mismatched ownership URI before inspecting the system', () => {
    vi.mocked(execFileSync).mockClear();
    expect(() =>
      verifyTestDatabaseOwner(memory, new URL(ci.MONGODB_URI)),
    ).toThrow();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it.runIf(process.platform === 'win32')(
    'checks the memory child PID, parent, path and listener',
    () => {
      const identity = {
        pid: 1234,
        parent: 1233,
        name: 'mongod-x64-win32-8.0.13.exe',
        command: `mongod --dbpath ${memory.HMS_TEST_DBPATH}`,
        listeners: [{ address: '127.0.0.1', pid: 1234 }],
      };
      vi.mocked(execFileSync).mockReturnValue(JSON.stringify(identity));
      expect(() =>
        verifyTestDatabaseOwner(memory, new URL(memory.MONGODB_URI)),
      ).not.toThrow();
      for (const invalid of [
        { ...identity, pid: 9999 },
        { ...identity, parent: 9999 },
        { ...identity, command: 'mongod --dbpath unknown' },
        { ...identity, listeners: [{ address: '127.0.0.1', pid: 9999 }] },
        { ...identity, listeners: [{ address: '0.0.0.0', pid: 1234 }] },
      ]) {
        vi.mocked(execFileSync).mockReturnValue(JSON.stringify(invalid));
        expect(() =>
          verifyTestDatabaseOwner(memory, new URL(memory.MONGODB_URI)),
        ).toThrow();
      }
    },
  );

  const container = () => ({
    Id: ci.HMS_TEST_SERVICE_ID,
    Config: {
      Image: 'mongo:8',
      Labels: {
        'hms.test.run': ci.GITHUB_RUN_ID,
        'hms.test.attempt': '1',
        'hms.test.job': 'backend',
      },
    },
    HostConfig: {
      Tmpfs: { '/data/db': '', '/data/configdb': '' },
      Binds: [] as string[],
    },
    State: { Running: true, Health: { Status: 'healthy' } },
    Mounts: ['/data/db', '/data/configdb'].map((Destination) => ({
      Type: 'tmpfs',
      Destination,
    })),
    NetworkSettings: {
      Ports: {
        '27017/tcp': [
          { HostIp: '0.0.0.0', HostPort: ci.HMS_TEST_SERVICE_PORT },
        ],
      },
    },
  });

  it('accepts the observed Docker tmpfs metadata with empty Mounts', () => {
    vi.mocked(execFileSync).mockReturnValue(
      JSON.stringify([{ ...container(), Mounts: [] }]),
    );
    expect(() =>
      verifyTestDatabaseOwner(ci, new URL(ci.MONGODB_URI)),
    ).not.toThrow();
  });

  it.each([
    'empty',
    'missing',
    'extra',
    'bind',
    'volume',
    'duplicate',
    'partial',
  ])('rejects invalid authoritative storage proof %s', (field) => {
    const value = container();
    if (field === 'empty') {
      value.HostConfig.Tmpfs = {} as typeof value.HostConfig.Tmpfs;
      value.Mounts = [];
    }
    if (field === 'missing')
      delete (value.HostConfig.Tmpfs as Record<string, string>)['/data/db'];
    if (field === 'extra')
      (value.HostConfig.Tmpfs as Record<string, string>)['/extra'] = '';
    if (field === 'bind') value.HostConfig.Binds = ['/shared:/extra'];
    if (field === 'volume')
      value.Mounts.push({ Type: 'volume', Destination: '/extra' });
    if (field === 'duplicate') value.Mounts[1].Destination = '/data/db';
    if (field === 'partial') value.Mounts.pop();
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify([value]));
    expect(() =>
      verifyTestDatabaseOwner(ci, new URL(ci.MONGODB_URI)),
    ).toThrow();
  });

  it('verifies the exact job service through Docker inspection', () => {
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify([container()]));
    expect(() =>
      verifyTestDatabaseOwner(ci, new URL(ci.MONGODB_URI)),
    ).not.toThrow();
    expect(execFileSync).toHaveBeenLastCalledWith(
      'docker',
      ['inspect', ci.HMS_TEST_SERVICE_ID],
      { encoding: 'utf8' },
    );
  });

  it('reports failed predicates without disclosing Docker environment or arbitrary labels', () => {
    const value = {
      ...container(),
      Mounts: [],
      State: { Running: false, Health: { Status: 'healthy' } },
      HostConfig: {
        Tmpfs: { '/data/db': '', '/data/configdb': '' },
        Binds: null,
      },
      Config: {
        ...container().Config,
        Env: ['PRIVATE_KEY=sentinel-secret'],
        Labels: { ...container().Config.Labels, private: 'sentinel-secret' },
      },
    };
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify([value]));
    let message = '';
    try {
      verifyTestDatabaseOwner(ci, new URL(ci.MONGODB_URI));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('"running":false');
    expect(message).toContain('"tmpfsTargets":["/data/configdb","/data/db"]');
    expect(message).toContain('"mounts":[]');
    expect(message).not.toContain('sentinel-secret');
    expect(message).not.toContain('PRIVATE_KEY');
  });

  it.each(['id', 'port', 'run', 'attempt', 'mount', 'health'])(
    'rejects a mismatched service %s',
    (field) => {
      const value = container();
      if (field === 'id') value.Id = 'b'.repeat(64);
      if (field === 'port')
        value.NetworkSettings.Ports['27017/tcp'][0].HostPort = '27017';
      if (field === 'run') value.Config.Labels['hms.test.run'] = 'unknown';
      if (field === 'attempt') value.Config.Labels['hms.test.attempt'] = '2';
      if (field === 'mount') value.Mounts[0].Type = 'bind';
      if (field === 'health') value.State.Health.Status = 'unhealthy';
      vi.mocked(execFileSync).mockReturnValue(JSON.stringify([value]));
      expect(() =>
        verifyTestDatabaseOwner(ci, new URL(ci.MONGODB_URI)),
      ).toThrow();
    },
  );

  it.each([memory, ci])('admits an explicit harness identity (%#)', (env) => {
    expect(() => assertDisposableTestEnvironment(env)).not.toThrow();
    expect(() => assertServiceOrderTestDatabase(env)).not.toThrow();
  });

  it.each([
    undefined,
    '',
    'invalid',
    'mongodb://localhost:27017/hms_test',
    'mongodb://127.0.0.1:27017/hms_test',
    'mongodb://127.0.0.1/hms_test',
    'mongodb://remote:49152/hms_intake_memory_test',
    'mongodb://localhost:49152/hms_intake_memory_test',
    'mongodb://127.0.0.1:49152/unknown',
    'mongodb://127.0.0.1:49152/hms_test?directConnection=true',
    'mongodb://127.0.0.1:49152/hms_test#fragment',
    'mongodb://user:password@127.0.0.1:49152/hms_test',
    'mongodb+srv://127.0.0.1/hms_test',
  ])('rejects an unsafe actual URI (%#)', (uri) => {
    expect(() =>
      assertDisposableTestEnvironment({ ...memory, MONGODB_URI: uri }),
    ).toThrow();
  });

  it.each([
    'HMS_TEST_HARNESS',
    'HMS_TEST_URI',
    'HMS_TEST_OWNER_PID',
    'HMS_TEST_PARENT_PID',
    'HMS_TEST_DBPATH',
    'HMS_TEST_TOKEN',
  ])('rejects missing memory proof %s', (key) => {
    const env: NodeJS.ProcessEnv = { ...memory };
    delete env[key];
    expect(() => assertDisposableTestEnvironment(env)).toThrow();
  });

  it.each([
    'CI',
    'GITHUB_ACTIONS',
    'GITHUB_JOB',
    'GITHUB_RUN_ID',
    'GITHUB_RUN_ATTEMPT',
    'HMS_TEST_SERVICE_ID',
    'HMS_TEST_SERVICE_PORT',
  ])('rejects missing service proof %s', (key) => {
    const env: NodeJS.ProcessEnv = { ...ci };
    delete env[key];
    expect(() => assertDisposableTestEnvironment(env)).toThrow();
  });

  it.each([
    { CI: 'true' },
    { ...ci, MONGODB_URI: 'mongodb://localhost:27017/hms_test' },
    { ...ci, HMS_TEST_SERVICE_PORT: '27017' },
    { ...ci, HMS_TEST_SERVICE_ID: 'unknown' },
    { ...ci, GITHUB_JOB: 'frontend' },
    { ...memory, HMS_TEST_OWNER_PID: '0' },
    { ...memory, HMS_TEST_HARNESS: 'unknown' },
  ])('rejects unknown ownership or blanket CI admission (%#)', (env) => {
    expect(() => assertDisposableTestEnvironment(env)).toThrow();
  });

  it.each([
    'mongodb://127.0.0.1:49152/hms_intake_memory_test',
    'mongodb://127.0.0.1:49152/hms_task29_uc47_test',
  ])('accepts a dedicated derived database name', (uri) => {
    expect(() => assertTestDatabase(uri)).not.toThrow();
  });

  it.each([
    undefined,
    'invalid',
    'mongodb://localhost:27017/hms_test',
    'mongodb://127.0.0.1:49152/hms',
  ])('rejects an unsafe database URI (%#)', (uri) => {
    expect(() => assertTestDatabase(uri)).toThrow();
  });
});
