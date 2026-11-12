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
    const bindings = container.NetworkSettings.Ports['27017/tcp'];
    if (
      container.Id !== env.HMS_TEST_SERVICE_ID ||
      container.Config.Image !== 'mongo:8' ||
      container.Config.Labels?.['hms.test.run'] !== env.GITHUB_RUN_ID ||
      container.Config.Labels?.['hms.test.attempt'] !==
        env.GITHUB_RUN_ATTEMPT ||
      container.Config.Labels?.['hms.test.job'] !== 'backend' ||
      container.Mounts?.length !== 2 ||
      !container.Mounts.every(
        (mount: { Type: string; Destination: string }) =>
          mount.Type === 'tmpfs' &&
          ['/data/db', '/data/configdb'].includes(mount.Destination),
      ) ||
      !container.State.Running ||
      container.State.Health?.Status !== 'healthy' ||
      !bindings?.some(
        (binding: { HostIp: string; HostPort: string }) =>
          binding.HostPort === uri.port &&
          ['127.0.0.1', '0.0.0.0'].includes(binding.HostIp),
      )
    )
      throw new Error('Disposable job container ownership verification failed');
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
