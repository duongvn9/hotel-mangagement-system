import { cleanupSmokeResources, withSmokeCleanup } from './smoke-ownership.mjs';

const env = {
  HMS_SMOKE_PROJECT: 'hms-smoke-123-1-' + 'a'.repeat(32),
  HMS_SMOKE_TOKEN: 'a'.repeat(32),
  HMS_SMOKE_STARTED: '2026-11-12T00:00:00Z',
};
const labels = {
  'com.docker.compose.project': env.HMS_SMOKE_PROJECT,
  'hms.smoke.token': env.HMS_SMOKE_TOKEN,
};
function fixture() {
  const containers = new Map<string, any>([
    [
      'b'.repeat(64),
      {
        Id: 'b'.repeat(64),
        Created: env.HMS_SMOKE_STARTED,
        Config: { Labels: { ...labels } },
        State: { Running: false },
      },
    ],
  ]);
  const networks = new Map<string, any>([
    [
      'c'.repeat(64),
      {
        Id: 'c'.repeat(64),
        Created: env.HMS_SMOKE_STARTED,
        Labels: { ...labels },
        Containers: {},
      },
    ],
  ]);
  const docker = vi.fn((args: string[]) => {
    if (args[1] === 'ls') {
      expect(args).toContain(
        `label=com.docker.compose.project=${env.HMS_SMOKE_PROJECT}`,
      );
      if (args[0] === 'container') {
        expect(args).toContain('--all');
        return [...containers.keys()].join('\n');
      }
      if (args[0] === 'network') return [...networks.keys()].join('\n');
      if (args[0] === 'volume') return '';
    }
    if (args[0] === 'inspect') return JSON.stringify([containers.get(args[1])]);
    if (args[0] === 'network' && args[1] === 'inspect')
      return JSON.stringify([networks.get(args[2])]);
    if (args[0] === 'rm') {
      containers.delete(args[2]);
      return args[2];
    }
    if (args[0] === 'network' && args[1] === 'rm') {
      networks.delete(args[2]);
      return args[2];
    }
    throw Error(`Unexpected subprocess: ${args.join(' ')}`);
  });
  return { containers, networks, docker };
}

describe('smoke cleanup subprocess lifecycle', () => {
  it('cleans partial stopped containers after compose startup fails, without runtime admission', async () => {
    const { docker, containers, networks } = fixture();
    const report = vi.fn();
    await expect(
      withSmokeCleanup(
        env,
        docker,
        async () => {
          throw Error('compose failed');
        },
        report,
      ),
    ).rejects.toThrow('compose failed');
    expect(containers.size + networks.size).toBe(0);
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
        cleanup: expect.objectContaining({ status: 'passed' }),
      }),
    );
    expect(docker.mock.calls.some(([a]) => a[0] === 'rm')).toBe(true);
  });
  it('cleans after admission failure or backend crash', async () => {
    const { docker, containers } = fixture();
    await expect(
      withSmokeCleanup(
        env,
        docker,
        async () => {
          throw Error('not running');
        },
        vi.fn(),
      ),
    ).rejects.toThrow('not running');
    expect(containers.size).toBe(0);
  });
  it('tolerates absent resources and reports passed only after verified absence', async () => {
    const { docker, containers, networks } = fixture();
    containers.clear();
    networks.clear();
    const report = vi.fn(() => {
      expect(containers.size + networks.size).toBe(0);
    });
    await withSmokeCleanup(
      env,
      docker,
      async () => ({ commands: 8, scripts: 5 }),
      report,
    );
    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'passed',
        cleanup: expect.objectContaining({ status: 'passed' }),
      }),
    );
  });
  it.each(['token', 'project', 'created', 'inspect'])(
    'preserves inconclusive %s ownership and reports blocked',
    async (field) => {
      const { docker, containers } = fixture();
      const row = [...containers.values()][0];
      if (field === 'token') row.Config.Labels['hms.smoke.token'] = 'unknown';
      if (field === 'project')
        row.Config.Labels['com.docker.compose.project'] = 'unknown';
      if (field === 'created') row.Created = '2000-01-01T00:00:00Z';
      if (field === 'inspect')
        docker.mockImplementation((args) => {
          if (args[0] === 'inspect') throw Error('unavailable');
          if (args[0] === 'container') return row.Id;
          return '';
        });
      const report = vi.fn();
      await expect(
        withSmokeCleanup(env, docker, async () => ({}), report),
      ).rejects.toThrow();
      expect(containers.size).toBe(1);
      expect(docker.mock.calls.some(([a]) => a[0] === 'rm')).toBe(false);
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'blocked',
          cleanup: expect.objectContaining({ status: 'blocked' }),
        }),
      );
    },
  );
  it('preserves an attached network and continues removal of proven containers', () => {
    const { docker, containers, networks } = fixture();
    [...networks.values()][0].Containers = { unknown: {} };
    const result = cleanupSmokeResources(env, docker);
    expect(result.status).toBe('blocked');
    expect(containers.size).toBe(0);
    expect(networks.size).toBe(1);
    expect(
      docker.mock.calls.some(([a]) => a[0] === 'network' && a[1] === 'rm'),
    ).toBe(false);
  });
  it('blocks success when removal fails or a resource remains', async () => {
    const { docker } = fixture();
    const original = docker.getMockImplementation()!;
    docker.mockImplementation((args) =>
      args[0] === 'rm' ? '' : original(args),
    );
    const report = vi.fn();
    await expect(
      withSmokeCleanup(env, docker, async () => ({}), report),
    ).rejects.toThrow();
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'blocked' }),
    );
  });
  it('tolerates a resource disappearing between inventory and inspection', () => {
    const { docker, containers } = fixture();
    const original = docker.getMockImplementation()!;
    docker.mockImplementation((args) => {
      if (args[0] === 'inspect') {
        containers.clear();
        throw Error('No such object');
      }
      return original(args);
    });
    expect(cleanupSmokeResources(env, docker).status).toBe('passed');
    expect(docker.mock.calls.some(([args]) => args[0] === 'rm')).toBe(false);
  });
  it('reports blocked on a removal subprocess failure while retaining the resource', () => {
    const { docker, containers } = fixture();
    const original = docker.getMockImplementation()!;
    docker.mockImplementation((args) => {
      if (args[0] === 'rm') throw Error('removal denied');
      return original(args);
    });
    const result = cleanupSmokeResources(env, docker);
    expect(result.status).toBe('blocked');
    expect(containers.size).toBe(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ error: 'removal denied' }),
      ]),
    );
  });
  it('does not delete resources that appeared after the first inventory', () => {
    const { docker, containers } = fixture();
    const original = docker.getMockImplementation()!;
    let inventories = 0;
    docker.mockImplementation((args) => {
      if (args[0] === 'container' && args[1] === 'ls' && ++inventories === 2)
        containers.set('d'.repeat(64), {});
      return original(args);
    });
    expect(cleanupSmokeResources(env, docker).status).toBe('blocked');
    expect(
      docker.mock.calls.some(
        ([a]) => a.includes('d'.repeat(64)) && a[0] === 'rm',
      ),
    ).toBe(false);
  });
});
