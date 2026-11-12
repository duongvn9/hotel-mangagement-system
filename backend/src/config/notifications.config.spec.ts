import { envValidationSchema } from './env.validation.js';
import { notificationConfiguration } from './notifications.config.js';

const base = { MONGODB_URI: 'mongodb://localhost/hms_test' };
describe('H9 conditional configuration', () => {
  it('defaults disabled, with optional empty Brevo fields', () => {
    const result = envValidationSchema.validate({
      ...base,
      GMAIL_USER: '',
      BREVO_API_KEY: '',
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
  it.each(['GMAIL_USER', 'BREVO_API_KEY'])(
    'requires %s when enabled',
    (missing) => {
      const input: Record<string, unknown> = {
        ...base,
        NOTIFICATIONS_ENABLED: true,
        GMAIL_USER: 'sender@example.com',
        BREVO_API_KEY: 'xkeysib-test',
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
  it('requires a sender address and Brevo API key when enabled', () => {
    const input = {
      ...base,
      NOTIFICATIONS_ENABLED: 'true',
      GMAIL_USER: 'sender@example.com',
      BREVO_API_KEY: 'xkeysib-test',
    };
    expect(envValidationSchema.validate(input).error).toBeUndefined();
    expect(notificationConfiguration(input).brevoApiKey).toBe('xkeysib-test');
    expect(
      envValidationSchema.validate({ ...input, GMAIL_USER: '' }).error?.message,
    ).toContain('GMAIL_USER');
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
    { NOTIFICATIONS_ENABLED: true, GMAIL_USER: 'sender@example.com' },
    {
      NOTIFICATIONS_ENABLED: true,
      GMAIL_USER: 'sender@example.com',
      BREVO_API_KEY: '   ',
    },
  ])('rejects invalid configuration %j', (extra) =>
    expect(
      envValidationSchema.validate({ ...base, ...extra }).error,
    ).toBeDefined(),
  );
});
