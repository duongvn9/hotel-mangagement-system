import { Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import tls from 'node:tls';
import type { NotificationOptions } from '../../config/notifications.config.js';
import { maskRecipient } from './notification.templates.js';
import type {
  NotificationMessage,
  NotificationTransport,
} from './notification.types.js';

export class DisabledNotificationTransport implements NotificationTransport {
  private readonly logger = new Logger(DisabledNotificationTransport.name);
  async send(message: NotificationMessage): Promise<void> {
    this.logger.debug({
      event: 'notification_disabled',
      template: message.template,
      to: maskRecipient(message.to),
    });
  }
}

/** Factory injection allows jsonTransport tests without any SMTP connection. */
export class GmailNotificationTransport implements NotificationTransport {
  constructor(
    private readonly options: NotificationOptions,
    private readonly create: (signal: AbortSignal) => Transporter = (signal) =>
      nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: options.user, pass: options.appPassword },
        connectionTimeout: options.sendTimeoutMs,
        greetingTimeout: options.sendTimeoutMs,
        socketTimeout: options.sendTimeoutMs,
        logger: false,
        debug: false,
        disableFileAccess: true,
        disableUrlAccess: true,
        // SMTPTransport.close() alone does not destroy its active socket.
        // Own the TLS socket so attempt timeout/shutdown can actually abort it.
        getSocket: (_options, callback) => {
          const socket = tls.connect({
            host: 'smtp.gmail.com',
            port: 465,
            servername: 'smtp.gmail.com',
            rejectUnauthorized: true,
          });
          const abort = () =>
            socket.destroy(new Error('Notification attempt aborted'));
          if (signal.aborted) abort();
          else signal.addEventListener('abort', abort, { once: true });
          socket.once('close', () =>
            signal.removeEventListener('abort', abort),
          );
          let reported = false;
          socket.once('secureConnect', () => {
            if (!reported) {
              reported = true;
              callback(null, { connection: socket, secured: true });
            }
          });
          socket.on('error', (error) => {
            if (!reported) {
              reported = true;
              callback(error, {});
            }
          });
        },
      }),
  ) {}

  async send(message: NotificationMessage, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    const transport = this.create(signal);
    const abort = () => transport.close();
    signal.addEventListener('abort', abort, { once: true });
    try {
      await transport.sendMail({
        from: { name: this.options.fromName, address: this.options.user },
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
    } finally {
      signal.removeEventListener('abort', abort);
      transport.close();
    }
  }
}

/**
 * Brevo transactional API over HTTPS. Render's free plan blocks outbound SMTP
 * ports, so Gmail SMTP times out there. Errors carry only a code (never the body).
 */
export class BrevoNotificationTransport implements NotificationTransport {
  constructor(
    private readonly options: NotificationOptions,
    private readonly request: typeof fetch = fetch,
  ) {}

  async send(message: NotificationMessage, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return;
    let response: Response;
    try {
      response = await this.request('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.options.brevoApiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.options.fromName, email: this.options.user },
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
        signal,
      });
    } catch {
      throw Object.assign(new Error('Brevo request failed'), {
        code: 'ECONNECTION',
      });
    }
    if (response.ok) return;
    const { status } = response;
    const code =
      status === 401 || status === 403
        ? 'EAUTH'
        : status === 429 || status >= 500
          ? 'ECONNECTION'
          : undefined;
    throw Object.assign(new Error(`Brevo responded ${status}`), { code });
  }
}
