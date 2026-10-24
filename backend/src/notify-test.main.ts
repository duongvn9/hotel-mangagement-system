import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { isEmail } from 'class-validator';
import { configuration } from './config/configuration.js';
import { envValidationSchema } from './config/env.validation.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { NotificationsService } from './modules/notifications/notifications.service.js';

// Explicit, user-invoked SMTP tool. Never import/run this entry point in automated tests.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !isEmail(args[0]) || /[\r\n]/.test(args[0]))
    throw new Error(
      'Usage: npm run notify:test -- recipient@example.com (one explicit recipient required)',
    );
  // Load/validate env only after checking the explicit recipient argument.
  @Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [configuration],
        validationSchema: envValidationSchema,
      }),
      NotificationsModule,
    ],
  })
  class NotificationTestModule {}
  const app = await NestFactory.createApplicationContext(
    NotificationTestModule,
    { abortOnError: false, logger: false },
  );
  try {
    app.useLogger(new Logger('NotificationTest'));
    const config = app.get(ConfigService);
    if (
      config.get('notifications.enabled') !== true ||
      !config.get('notifications.user') ||
      !config.get('notifications.appPassword')
    )
      throw new Error(
        'Enable NOTIFICATIONS_ENABLED and configure GMAIL_USER / GMAIL_APP_PASSWORD first',
      );
    const service = app.get(NotificationsService);
    const result = await service.send({
      to: args[0],
      template: 'BOOKING_CANCELLATION',
      data: {
        bookingCode: 'H9-TEST-KHONG-PHAI-BOOKING-THAT',
        guestName: 'Kiểm tra cấu hình Gmail',
        checkIn: new Date(),
        checkOut: new Date(),
        cancelledAt: new Date(),
      },
    });
    if (!result.accepted) throw new Error('Test notification was not accepted');
    await service.drain();
    console.log(
      'Test queue drained. Check the recipient inbox; SMTP acceptance does not guarantee delivery.',
    );
  } finally {
    await app.close();
  }
}
void main().catch(() => {
  // Joi/SMTP exceptions may include secret values: do not print them.
  console.error(
    'Notification test refused or failed. Usage: npm run notify:test -- recipient@example.com. Requires NOTIFICATIONS_ENABLED=true, valid GMAIL_USER/GMAIL_APP_PASSWORD and MONGODB_URI. No credentials are printed.',
  );
  process.exitCode = 1;
});
