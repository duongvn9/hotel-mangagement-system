import Joi from 'joi';
import { notificationConfigFields } from './notifications.config.js';
import { vnpayConfigFields } from './vnpay.config.js';

/**
 * Kiểm tra biến môi trường ngay khi app khởi động.
 * Thiếu biến bắt buộc thì app dừng luôn, không chạy với cấu hình sai.
 * Thêm biến mới: khai báo ở đây + configuration.ts + .env.example.
 */
export const envValidationSchema = Joi.object({
  ...notificationConfigFields,
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  SWAGGER_ENABLED: Joi.boolean().default(true),

  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),

  // Firebase Authentication (BR-INT-01/02) — điền khi làm task xác thực
  FIREBASE_PROJECT_ID: Joi.string().allow('').optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').optional(),

  // VNPay (UC20, UC21)
  VNPAY_TMN_CODE: vnpayConfigFields.tmnCode.allow('').optional(),
  VNPAY_HASH_SECRET: vnpayConfigFields.hashSecret.allow('').optional(),
  VNPAY_PAYMENT_URL: vnpayConfigFields.paymentUrl.allow('').optional(),
  VNPAY_RETURN_URL: vnpayConfigFields.returnUrl.allow('').optional(),
  VNPAY_IPN_URL: vnpayConfigFields.ipnUrl.allow('').optional(),

  // Legacy Gmail configuration aliases (BR-NOTI)
  MAIL_APP_PASSWORD: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().allow('').optional(),
})
  .custom((values, helpers) => {
    if (values.NOTIFICATIONS_ENABLED) {
      if (!(values.MAIL_USER || values.GMAIL_USER))
        return helpers.error('any.custom', {
          message: 'MAIL_USER is required when notifications are enabled',
        });
      if (!(
        values.MAIL_PASS ||
        values.GMAIL_APP_PASSWORD ||
        values.MAIL_APP_PASSWORD
      ))
        return helpers.error('any.custom', {
          message: 'MAIL_PASS is required when notifications are enabled',
        });
    }
    return values;
  })
  .messages({
    'any.custom':
      'GMAIL_USER (or MAIL_USER) and GMAIL_APP_PASSWORD (or MAIL_PASS) are required when notifications are enabled',
  });
