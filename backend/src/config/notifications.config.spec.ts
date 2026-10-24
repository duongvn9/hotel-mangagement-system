import { envValidationSchema } from './env.validation.js';
import { notificationConfiguration } from './notifications.config.js';

const base = { MONGODB_URI: 'mongodb://localhost/hms_test' };
describe('H9 conditional configuration', () => {
  it('defaults disabled, with optional empty Gmail fields', () => {
    const result = envValidationSchema.validate({
      ...base,
      GMAIL_USER: '',
      GMAIL_APP_PASSWORD: '',
    });
    expect(result.error).toBeUndefined();
    expect(result.value.NOTIFICATIONS_ENABLED).toBe(false);
    expect(notificationConfiguration({})).toMatchObject({
      enabled: false,
      maxAttempts: 3,
      queueCapacity: 100,
      sendTimeoutMs: 10000,
    });
  });
  it.each(['GMAIL_USER', 'GMAIL_APP_PASSWORD'])(
    'requires %s when enabled',
    (missing) => {
      const input: Record<string, unknown> = {
        ...base,
        NOTIFICATIONS_ENABLED: true,
        GMAIL_USER: 'sender@example.com',
        GMAIL_APP_PASSWORD: 'abcdefghijklmnop',
      };
      delete input[missing];
      expect(envValidationSchema.validate(input).error?.message).toContain(
        missing,
      );
      input[missing] = '';
      expect(envValidationSchema.validate(input).error?.message).toContain(
        missing,
      );
    },
  );
  it('accepts spaced App Password and normalizes both Joi and configuration output', () => {
    const input = {
      ...base,
      NOTIFICATIONS_ENABLED: 'true',
      GMAIL_USER: 'sender@example.com',
      GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
    };
    const result = envValidationSchema.validate(input);
    expect(result.error).toBeUndefined();
    expect(result.value.GMAIL_APP_PASSWORD).toBe('abcdefghijklmnop');
    expect(notificationConfiguration(input).appPassword).toBe(
      'abcdefghijklmnop',
    );
  });
  it.each([
    { NOTIFICATIONS_ENABLED: 'yes' },
    { NOTIFICATIONS_MAX_ATTEMPTS: 0 },
    { NOTIFICATIONS_MAX_ATTEMPTS: 11 },
    { NOTIFICATIONS_RETRY_BASE_DELAY_MS: -1 },
    { NOTIFICATIONS_SEND_TIMEOUT_MS: 0 },
    { NOTIFICATIONS_QUEUE_CAPACITY: 1.5 },
    { NOTIFICATIONS_SHUTDOWN_TIMEOUT_MS: 9999999 },
    { NOTIFICATIONS_FROM_NAME: 'x\r\nBcc: y' },
    { GMAIL_USER: 'not-an-email' },
    {
      NOTIFICATIONS_ENABLED: true,
      GMAIL_USER: 'sender@example.com',
      GMAIL_APP_PASSWORD: '    ',
    },
  ])('rejects invalid configuration %j', (extra) =>
    expect(
      envValidationSchema.validate({ ...base, ...extra }).error,
    ).toBeDefined(),
  );
});
