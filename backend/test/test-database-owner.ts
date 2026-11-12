import { execFileSync } from 'node:child_process';
import { assertDisposableTestEnvironment } from './test-database.js';

export function verifyTestDatabaseOwner(
  env: NodeJS.ProcessEnv,
  uri: URL,
): void {
  if (assertDisposableTestEnvironment(env).href !== uri.href)
    throw new Error('Owner proof URI does not match the admitted endpoint');
  if (env.HMS_TEST_HARNESS === 'github-service') {
    const [container] = JSON.parse(
      execFileSync('docker', ['inspect', env.HMS_TEST_SERVICE_ID!], {
        encoding: 'utf8',
      }),
    );
    const bindings = container?.NetworkSettings?.Ports?.['27017/tcp'];
    const checks = {
      id: container?.Id === env.HMS_TEST_SERVICE_ID,
      image: container?.Config?.Image === 'mongo:8',
      run: container?.Config?.Labels?.['hms.test.run'] === env.GITHUB_RUN_ID,
      attempt:
        container?.Config?.Labels?.['hms.test.attempt'] ===
        env.GITHUB_RUN_ATTEMPT,
      job: container?.Config?.Labels?.['hms.test.job'] === 'backend',
      mountCount: container?.Mounts?.length === 2,
      mountTargets:
        Array.isArray(container?.Mounts) &&
        container.Mounts.every(
          (mount: { Type: string; Destination: string }) =>
            mount.Type === 'tmpfs' &&
            ['/data/db', '/data/configdb'].includes(mount.Destination),
        ),
      running: Boolean(container?.State?.Running),
      healthy: container?.State?.Health?.Status === 'healthy',
      binding: Boolean(
        bindings?.some(
          (binding: { HostIp: string; HostPort: string }) =>
            binding.HostPort === uri.port &&
            ['127.0.0.1', '0.0.0.0'].includes(binding.HostIp),
        ),
      ),
    };
    if (!Object.values(checks).every(Boolean)) {
      const facts = {
        mounts: container?.Mounts?.map(
          (mount: { Type: string; Destination: string }) => ({
            type: mount.Type,
            destination: mount.Destination,
          }),
        ),
        tmpfsTargets: Object.keys(container?.HostConfig?.Tmpfs ?? {}).sort(),
        bindCount: container?.HostConfig?.Binds?.length ?? 0,
        bindings: bindings?.map(
          (binding: { HostIp: string; HostPort: string }) => ({
            address: binding.HostIp,
            port: binding.HostPort,
          }),
        ),
        expectedPort: uri.port,
      };
      throw new Error(
        `Disposable job container ownership verification failed: ${JSON.stringify({ checks, facts })}`,
      );
    }
    return;
  }
  const pid = Number(env.HMS_TEST_OWNER_PID);
  const parent = Number(env.HMS_TEST_PARENT_PID);
  if (process.platform === 'win32') {
    const identity = JSON.parse(
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}"; $listeners = @(Get-NetTCPConnection -State Listen -LocalPort ${Number(uri.port)} -ErrorAction Stop); @{ pid = $p.ProcessId; parent = $p.ParentProcessId; name = $p.Name; command = $p.CommandLine; listeners = @($listeners | ForEach-Object { @{ address = $_.LocalAddress; pid = $_.OwningProcess } }) } | ConvertTo-Json -Depth 4 -Compress`,
        ],
        { encoding: 'utf8' },
      ),
    );
    if (
      identity.pid !== pid ||
      identity.parent !== parent ||
      identity.name !== 'mongod-x64-win32-8.0.13.exe' ||
      !identity.command
        ?.replaceAll('\\', '/')
        .includes(env.HMS_TEST_DBPATH?.replaceAll('\\', '/')) ||
      !env.HMS_TEST_DBPATH ||
      identity.listeners.length !== 1 ||
      identity.listeners[0].pid !== pid ||
      identity.listeners[0].address !== '127.0.0.1'
    )
      throw new Error(
        'Memory MongoDB process/listener ownership verification failed',
      );
    return;
  }
  throw new Error(
    'Memory ownership verification is not implemented on this platform; use verified CI service',
  );
}
