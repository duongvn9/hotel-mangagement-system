import Joi from 'joi';

/**
 * Kiểm tra biến môi trường ngay khi app khởi động.
 * Thiếu biến bắt buộc thì app dừng luôn, không chạy với cấu hình sai.
 * Thêm biến mới: khai báo ở đây + configuration.ts + .env.example.
 */
export const envValidationSchema = Joi.object({
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
  VNPAY_TMN_CODE: Joi.string().allow('').optional(),
  VNPAY_HASH_SECRET: Joi.string().allow('').optional(),
  VNPAY_PAYMENT_URL: Joi.string().allow('').optional(),
  VNPAY_RETURN_URL: Joi.string().allow('').optional(),

  // Gmail notification (BR-NOTI)
  MAIL_USER: Joi.string().allow('').optional(),
  MAIL_APP_PASSWORD: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().allow('').optional(),
});
