import Joi from 'joi';

// Joi's conditional schema requires "then"; NUL is deliberately excluded from headers.
/* eslint-disable unicorn/no-thenable, no-control-regex */

export const notificationConfigFields = {
  NOTIFICATIONS_ENABLED: Joi.boolean().default(false),
  GMAIL_USER: Joi.string()
    .email({ tlds: { allow: false } })
    .when('NOTIFICATIONS_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.allow('').optional(),
    }),
  GMAIL_APP_PASSWORD: Joi.string()
    .replace(/\s/g, '')
    .when('NOTIFICATIONS_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.allow('').optional(),
    }),
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
  user: env.GMAIL_USER ?? '',
  appPassword: (env.GMAIL_APP_PASSWORD ?? '').replace(/\s/g, ''),
  fromName: env.NOTIFICATIONS_FROM_NAME ?? 'Grand Emily Hotel',
  maxAttempts: Number(env.NOTIFICATIONS_MAX_ATTEMPTS ?? 3),
  retryBaseDelayMs: Number(env.NOTIFICATIONS_RETRY_BASE_DELAY_MS ?? 1000),
  sendTimeoutMs: Number(env.NOTIFICATIONS_SEND_TIMEOUT_MS ?? 10000),
  queueCapacity: Number(env.NOTIFICATIONS_QUEUE_CAPACITY ?? 100),
  shutdownTimeoutMs: Number(env.NOTIFICATIONS_SHUTDOWN_TIMEOUT_MS ?? 15000),
});
export type NotificationOptions = ReturnType<typeof notificationConfiguration>;
export const NOTIFICATION_OPTIONS = Symbol('NOTIFICATION_OPTIONS');
