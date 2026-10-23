/** Validate the database name, never credentials, host names or query values. */
export function assertTestDatabase(uri: string | undefined): void {
  let database = '';
  try {
    const parsed = new URL(uri ?? '');
    if (['mongodb:', 'mongodb+srv:'].includes(parsed.protocol))
      database = parsed.pathname.slice(1);
  } catch {
    // Report a configuration error without including potentially secret URIs.
  }
  if (!/^hms_(?:[a-z0-9]+_)*test$/.test(database))
    throw new Error('Set dedicated hms_*test MONGODB_URI (CI: hms_test)');
}
