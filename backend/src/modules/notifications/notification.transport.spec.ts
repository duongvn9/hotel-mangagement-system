import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import nodemailer from 'nodemailer';
import tls from 'node:tls';
import { EventEmitter } from 'node:events';
import { notificationConfiguration } from '../../config/notifications.config.js';
import {
  DisabledNotificationTransport,
  GmailNotificationTransport,
} from './notification.transport.js';
import { NotificationsModule } from './notifications.module.js';
import { NotificationsService } from './notifications.service.js';
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
  it('passes the attempt AbortSignal into its owned TLS socket, with certificate validation', async () => {
    const socket = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    const connect = vi.spyOn(tls, 'connect').mockReturnValue(socket as never);
    const factory = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      close: vi.fn(),
      sendMail: vi.fn().mockResolvedValue({}),
    } as never);
    const transport = new GmailNotificationTransport(
      notificationConfiguration({}),
    );
    const controller = new AbortController();
    await transport.send(message, controller.signal);
    const options = factory.mock.calls[0][0] as {
      getSocket: (
        options: object,
        callback: (...args: unknown[]) => void,
      ) => void;
    };
    const callback = vi.fn();
    options.getSocket({}, callback);
    expect(connect).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      servername: 'smtp.gmail.com',
      rejectUnauthorized: true,
    });
    controller.abort();
    expect(socket.destroy).toHaveBeenCalled();
    socket.emit('secureConnect');
    expect(callback).toHaveBeenCalledExactlyOnceWith(null, {
      connection: socket,
      secured: true,
    });
    socket.emit('error', new Error('late error'));
    expect(callback).toHaveBeenCalledTimes(1);
  });
  it('composes from/to/subject/html/text using Nodemailer jsonTransport', async () => {
    const json = nodemailer.createTransport({ jsonTransport: true });
    const send = vi.spyOn(json, 'sendMail');
    const transport = new GmailNotificationTransport(
      { ...notificationConfiguration({}), user: 'sender@example.com' },
      () => json,
    );
    await transport.send(message, new AbortController().signal);
    const result = await send.mock.results[0].value;
    const parsed = JSON.parse(result.message as string);
    expect(parsed).toMatchObject({
      from: { address: 'sender@example.com', name: 'Grand Emily Hotel' },
      to: [{ address: 'alice@example.com', name: '' }],
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  });
  it('constructs Gmail TLS SMTP options without connecting and closes on abort', async () => {
    const close = vi.fn();
    const sendMail = vi.fn(() => new Promise(() => {}));
    const factory = vi
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({ close, sendMail } as never);
    const transport = new GmailNotificationTransport({
      ...notificationConfiguration({}),
      user: 'sender@example.com',
      appPassword: 'fake-password',
    });
    const abort = new AbortController();
    void transport.send(message, abort.signal);
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: 'sender@example.com', pass: 'fake-password' },
        logger: false,
        debug: false,
      }),
    );
    abort.abort();
    expect(close).toHaveBeenCalled();
  });
  it('disabled provider never constructs SMTP and logs exactly one masked line per message', async () => {
    const smtp = vi
      .spyOn(nodemailer, 'createTransport')
      .mockImplementation(() => {
        throw new Error('No SMTP allowed');
      });
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
      expect(smtp).not.toHaveBeenCalled();
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
