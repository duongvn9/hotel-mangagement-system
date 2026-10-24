import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants.js';
import { Test } from '@nestjs/testing';
import nodemailer from 'nodemailer';
import { AppModule } from '../src/app.module.js';
import { NotificationsModule } from '../src/modules/notifications/notifications.module.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';
import { DisabledNotificationTransport } from '../src/modules/notifications/notification.transport.js';
import { NOTIFICATION_TRANSPORT } from '../src/modules/notifications/notification.types.js';
import { assertTestDatabase } from './test-database.js';

describe('H9 real AppModule, notifications disabled by default', () => {
  let app: INestApplication | undefined;
  const originalUri = process.env.MONGODB_URI;
  const originalEnabled = process.env.NOTIFICATIONS_ENABLED;
  beforeAll(async () => {
    assertTestDatabase(originalUri);
    const uri = new URL(originalUri!);
    uri.pathname = `/hms_h9_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    delete process.env.NOTIFICATIONS_ENABLED;
    vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => {
      throw new Error('SMTP forbidden in e2e');
    });
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  }, 60000);
  afterAll(async () => {
    await app?.close();
    vi.restoreAllMocks();
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
    if (originalEnabled === undefined) delete process.env.NOTIFICATIONS_ENABLED;
    else process.env.NOTIFICATIONS_ENABLED = originalEnabled;
  });
  it('boots without module cycle, exports H9 and never creates SMTP', async () => {
    expect(app!.get(NOTIFICATION_TRANSPORT)).toBeInstanceOf(
      DisabledNotificationTransport,
    );
    expect(
      Reflect.getMetadata(MODULE_METADATA.EXPORTS, NotificationsModule),
    ).toContain(NotificationsService);
    const service = app!.get(NotificationsService);
    expect(
      await service.send({
        to: 'test@example.com',
        template: 'BOOKING_CANCELLATION',
        data: {
          bookingCode: 'H9-E2E',
          guestName: 'Test',
          checkIn: '2026-10-24',
          checkOut: '2026-10-25',
          cancelledAt: '2026-10-24',
        },
      }),
    ).toEqual({ accepted: true });
    await service.drain();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
});
