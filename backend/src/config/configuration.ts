/**
 * Cấu hình đã được kiểm tra (xem env.validation.ts), gom theo nhóm.
 * Dùng trong code: configService.get('mongo.uri', { infer: true }).
 */
export const configuration = () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  mongo: {
    uri: process.env.MONGODB_URI as string,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  },
  vnpay: {
    tmnCode: process.env.VNPAY_TMN_CODE ?? '',
    hashSecret: process.env.VNPAY_HASH_SECRET ?? '',
    paymentUrl: process.env.VNPAY_PAYMENT_URL ?? '',
    returnUrl: process.env.VNPAY_RETURN_URL ?? '',
  },
  mail: {
    user: process.env.MAIL_USER ?? '',
    appPassword: process.env.MAIL_APP_PASSWORD ?? '',
    from: process.env.MAIL_FROM ?? '',
  },
});

export type AppConfig = ReturnType<typeof configuration>;
