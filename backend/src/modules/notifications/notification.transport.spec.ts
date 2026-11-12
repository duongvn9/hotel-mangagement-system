import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { notificationConfiguration } from '../../config/notifications.config.js';
import {
  BrevoNotificationTransport,
  DisabledNotificationTransport,
} from './notification.transport.js';
import { NotificationsModule } from './notifications.module.js';
import {
  classifyFailure,
  NotificationsService,
} from './notifications.service.js';
import {
  NOTIFICATION_TRANSPORT,
  type NotificationMessage,
} from './notification.types.js';

const message: NotificationMessage = {
  template: 'BOOKING_CANCELLATION',
  to: 'alice@example.com',
  subject: 'Đã hủy GE-1',
  text: 'Nội dung riêng',
  html: '<p>Nội dung riêng</p>',
};
describe('H9 transport selection and JSON composition (no network)', () => {
  afterEach(() => vi.restoreAllMocks());
  it('sends through the Brevo HTTPS API with the configured sender', async () => {
    const request = vi.fn().mockResolvedValue(new Response('{}'));
    const transport = new BrevoNotificationTransport(
      {
        ...notificationConfiguration({}),
        user: 'sender@example.com',
        brevoApiKey: 'xkeysib-test',
      },
      request,
    );
    const signal = new AbortController().signal;
    await transport.send(message, signal);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init).toMatchObject({ method: 'POST', signal });
    expect(init.headers).toMatchObject({ 'api-key': 'xkeysib-test' });
    expect(JSON.parse(init.body)).toEqual({
      sender: { name: 'Grand Emily Hotel', email: 'sender@example.com' },
      to: [{ email: 'alice@example.com' }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    });
  });
  it.each([
    [401, { category: 'auth' }],
    [429, { category: 'transient' }],
    [503, { category: 'transient' }],
    [400, { category: 'permanent' }],
  ])('classifies a Brevo HTTP %i response', async (status, expected) => {
    const transport = new BrevoNotificationTransport(
      notificationConfiguration({}),
      vi.fn().mockResolvedValue(new Response('{}', { status })),
    );
    const error = await transport
      .send(message, new AbortController().signal)
      .catch((e: unknown) => e);
    expect(classifyFailure(error)).toMatchObject(expected);
  });
  it('treats a Brevo network failure as transient', async () => {
    const transport = new BrevoNotificationTransport(
      notificationConfiguration({}),
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );
    const error = await transport
      .send(message, new AbortController().signal)
      .catch((e: unknown) => e);
    expect(classifyFailure(error)).toMatchObject({ category: 'transient' });
  });
  it('uses Brevo as the only enabled transport', async () => {
    const app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              notifications: notificationConfiguration({
                NOTIFICATIONS_ENABLED: 'true',
                GMAIL_USER: 'sender@example.com',
                BREVO_API_KEY: 'xkeysib-test',
              }),
            }),
          ],
        }),
        NotificationsModule,
      ],
    }).compile();
    expect(app.get(NOTIFICATION_TRANSPORT)).toBeInstanceOf(
      BrevoNotificationTransport,
    );
    await app.close();
  }, 60_000);
  it('disabled provider logs exactly one masked line per message', async () => {
    const debug = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => {});
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const app = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              env: 'production',
              notifications: notificationConfiguration({}),
            }),
          ],
        }),
        NotificationsModule,
      ],
    }).compile();
    await app.init();
    try {
      expect(app.get(NOTIFICATION_TRANSPORT)).toBeInstanceOf(
        DisabledNotificationTransport,
      );
      const service = app.get(NotificationsService);
      await expect(
        service.send({
          to: message.to,
          template: 'BOOKING_CANCELLATION',
          data: {
            bookingCode: 'GE-1',
            guestName: 'Alice',
            checkIn: '2026-10-24',
            checkOut: '2026-10-25',
            cancelledAt: '2026-10-24',
          },
        }),
      ).resolves.toEqual({ accepted: true });
      await service.drain();
      expect(debug).toHaveBeenCalledExactlyOnceWith({
        event: 'notification_disabled',
        template: message.template,
        to: 'a***@example.com',
      });
      expect(warn).toHaveBeenCalledExactlyOnceWith({
        event: 'notifications_disabled_in_production',
      });
      expect(JSON.stringify(debug.mock.calls)).not.toContain(message.to);
    } finally {
      await app.close();
    }
  });
});
