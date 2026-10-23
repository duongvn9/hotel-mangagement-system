import { assertTestDatabase } from './test-database.js';

describe('e2e database safety', () => {
  it.each([
    'mongodb://localhost:27017/hms_test',
    'mongodb://localhost:27017/hms_task29_uc47_test',
    'mongodb+srv://user:password@example.com/hms_test?retryWrites=true',
  ])('accepts dedicated test database %s', (uri) => {
    expect(() => assertTestDatabase(uri)).not.toThrow();
  });

  it.each([
    undefined,
    '',
    'invalid',
    'mongodb://localhost:27017/hms',
    'mongodb://hms_test:27017/hms_dev',
    'mongodb://hms_test:password@localhost/hms_production',
    'mongodb://localhost/hms_dev?appName=hms_test',
    'mongodb://localhost/hms_test_backup',
    'https://localhost/hms_test',
  ])('rejects unsafe or invalid database URI %#', (uri) => {
    expect(() => assertTestDatabase(uri)).toThrow('Set dedicated');
  });
});
