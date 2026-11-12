export function assertTestDatabase(uri: string | undefined): URL {
  let parsed: URL;
  try {
    parsed = new URL(uri ?? '');
  } catch {
    throw new Error('Explicit disposable MongoDB URI required');
  }
  if (
    parsed.protocol !== 'mongodb:' ||
    parsed.hostname !== '127.0.0.1' ||
    !parsed.port ||
    Number(parsed.port) < 1024 ||
    Number(parsed.port) > 65535 ||
    parsed.port === '27017' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !/^\/hms_(?:[a-z0-9]+_)*test$/.test(parsed.pathname)
  )
    throw new Error(
      'Only an explicit loopback disposable test endpoint is allowed',
    );
  return parsed;
}

export function assertDisposableTestEnvironment(env: NodeJS.ProcessEnv): URL {
  const uri = assertTestDatabase(env.MONGODB_URI);
  if (env.MONGODB_URI !== env.HMS_TEST_URI)
    throw new Error('Actual MongoDB URI must match the owning harness');
  if (
    env.HMS_TEST_HARNESS === 'memory' &&
    uri.pathname === '/hms_intake_memory_test' &&
    /^[1-9]\d*$/.test(env.HMS_TEST_OWNER_PID ?? '') &&
    /^[1-9]\d*$/.test(env.HMS_TEST_PARENT_PID ?? '') &&
    /^[a-f0-9]{32}$/.test(env.HMS_TEST_TOKEN ?? '') &&
    env.HMS_TEST_DBPATH?.replaceAll('\\', '/').endsWith(
      `/hms-pr106-${env.HMS_TEST_TOKEN}`,
    )
  )
    return uri;
  if (
    env.HMS_TEST_HARNESS === 'github-service' &&
    uri.pathname === '/hms_ci_test' &&
    env.CI === 'true' &&
    env.GITHUB_ACTIONS === 'true' &&
    env.GITHUB_JOB === 'backend' &&
    /^[1-9]\d*$/.test(env.GITHUB_RUN_ID ?? '') &&
    /^[1-9]\d*$/.test(env.GITHUB_RUN_ATTEMPT ?? '') &&
    /^[a-f0-9]{64}$/.test(env.HMS_TEST_SERVICE_ID ?? '') &&
    env.HMS_TEST_SERVICE_PORT === uri.port
  )
    return uri;
  throw new Error(
    'A verified disposable harness identity is required; CI alone is not admission',
  );
}

export function assertTestDatabaseTarget(database: string | undefined): void {
  if (
    !database ||
    !/^(?:hms_(?:[a-z0-9]+_)*test|invoice_idempotency_[a-f0-9]{24})$/.test(
      database,
    )
  )
    throw new Error('Blocked database outside the disposable test namespace');
}

export function assertServiceOrderTestDatabase(env: NodeJS.ProcessEnv): void {
  assertDisposableTestEnvironment(env);
}
