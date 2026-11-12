import Joi from 'joi';

// Joi's conditional schema requires "then"; NUL is deliberately excluded from headers.
/* eslint-disable unicorn/no-thenable, no-control-regex */

export const notificationConfigFields = {
  MAIL_HOST: Joi.string().hostname().default('smtp.gmail.com'),
  MAIL_PORT: Joi.number().port().default(465),
  MAIL_USER: Joi.string()
    .email({ tlds: { allow: false } })
    .allow('')
    .default(''),
  MAIL_PASS: Joi.string().allow('').default(''),
  MAIL_FROM_NAME: Joi.string()
    .pattern(/^[^\r\n\u0000]+$/)
    .max(200)
    .default('Grand Emily Hotel'),
  HOTEL_LOGO_URL: Joi.string().uri().allow('').default(''),
  HOTEL_BANNER_URL: Joi.string().uri().allow('').default(''),
  APP_BASE_URL: Joi.string().uri().allow('').default('http://localhost:5173'),
  NOTIFICATIONS_MAX_RETRIES: Joi.number().integer().min(0).max(10).default(3),
  NOTIFICATIONS_ENABLED: Joi.boolean().default(false),
  GMAIL_USER: Joi.string()
    .email({ tlds: { allow: false } })
    .allow('')
    .optional(),
  GMAIL_APP_PASSWORD: Joi.string().replace(/\s/g, '').allow('').optional(),
  BREVO_API_KEY: Joi.string().allow('').optional(),
  NOTIFICATIONS_FROM_NAME: Joi.string()
    .pattern(/^[^\r\n\u0000]+$/)
    .max(200)
    .default('Grand Emily Hotel'),
  NOTIFICATIONS_MAX_ATTEMPTS: Joi.number().integer().min(1).max(10).default(3),
  NOTIFICATIONS_RETRY_BASE_DELAY_MS: Joi.number()
    .integer()
    .min(1)
    .max(60000)
    .default(1000),
  NOTIFICATIONS_SEND_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1)
    .max(120000)
    .default(10000),
  NOTIFICATIONS_QUEUE_CAPACITY: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(100),
  NOTIFICATIONS_SHUTDOWN_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1)
    .max(120000)
    .default(15000),
};

export const notificationConfiguration = (env: NodeJS.ProcessEnv) => ({
  enabled: env.NOTIFICATIONS_ENABLED?.toLowerCase() === 'true',
  host: env.MAIL_HOST ?? 'smtp.gmail.com',
  port: Number(env.MAIL_PORT ?? 465),
  user: env.MAIL_USER || env.GMAIL_USER || '',
  appPassword: (
    env.MAIL_PASS ||
    env.GMAIL_APP_PASSWORD ||
    env.MAIL_APP_PASSWORD ||
    ''
  ).replace(/\s/g, ''),
  brevoApiKey: env.BREVO_API_KEY ?? '',
  fromName:
    env.MAIL_FROM_NAME ?? env.NOTIFICATIONS_FROM_NAME ?? 'Grand Emily Hotel',
  logoUrl: env.HOTEL_LOGO_URL ?? '',
  bannerUrl: env.HOTEL_BANNER_URL ?? '',
  appBaseUrl: env.APP_BASE_URL ?? 'http://localhost:5173',
  maxRetries: Number(env.NOTIFICATIONS_MAX_RETRIES ?? 3),
  maxAttempts: Number(env.NOTIFICATIONS_MAX_ATTEMPTS ?? 3),
  retryBaseDelayMs: Number(env.NOTIFICATIONS_RETRY_BASE_DELAY_MS ?? 1000),
  sendTimeoutMs: Number(env.NOTIFICATIONS_SEND_TIMEOUT_MS ?? 10000),
  queueCapacity: Number(env.NOTIFICATIONS_QUEUE_CAPACITY ?? 100),
  shutdownTimeoutMs: Number(env.NOTIFICATIONS_SHUTDOWN_TIMEOUT_MS ?? 15000),
});
export type NotificationOptions = ReturnType<typeof notificationConfiguration>;
export const NOTIFICATION_OPTIONS = Symbol('NOTIFICATION_OPTIONS');
