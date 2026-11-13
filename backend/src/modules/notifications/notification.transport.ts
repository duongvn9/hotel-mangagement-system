import { Logger } from '@nestjs/common';
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

/**
 * Brevo transactional API over HTTPS. Errors carry only a code (never the body).
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
