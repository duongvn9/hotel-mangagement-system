import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import {
  NOTIFICATION_OPTIONS,
  type NotificationOptions,
} from '../../config/notifications.config.js';
import { NotificationScheduler } from './notification.scheduler.js';
import { maskRecipient, renderNotification } from './notification.templates.js';
import {
  NOTIFICATION_TRANSPORT,
  type NotificationInput,
  type NotificationMessage,
  type NotificationResult,
  type NotificationTransport,
} from './notification.types.js';

const TIMEOUT = Symbol('timeout');
type Failure = {
  category: 'transient' | 'permanent' | 'timeout' | 'auth';
  code: string;
  hint?: string;
};
/** Never log raw transport errors: they may contain credentials, recipient or message body. */
export function classifyFailure(error: unknown): Failure {
  if (error === TIMEOUT) return { category: 'timeout', code: 'SEND_TIMEOUT' };
  const e =
    error && typeof error === 'object'
      ? (error as { responseCode?: unknown; code?: unknown })
      : {};
  const smtp =
    typeof e.responseCode === 'number' && Number.isInteger(e.responseCode)
      ? e.responseCode
      : 0;
  // SMTP 4xx (including a temporarily unavailable authentication service) wins
  // over Nodemailer's broader EAUTH classification.
  if (smtp >= 400 && smtp <= 499)
    return { category: 'transient', code: `SMTP_${smtp}` };
  if (smtp === 535 || e.code === 'EAUTH')
    return {
      category: 'auth',
      code: 'SMTP_AUTH',
      hint: 'Check GMAIL_USER and Google App Password / 2-Step Verification',
    };
  if (smtp >= 500 && smtp <= 599)
    return { category: 'permanent', code: `SMTP_${smtp}` };
  if (e.code === 'ETIMEDOUT') return { category: 'timeout', code: 'ETIMEDOUT' };
  const network = [
    'ECONNECTION',
    'ESOCKET',
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'EAI_AGAIN',
    'EDNS',
  ];
  if (typeof e.code === 'string' && network.includes(e.code))
    return { category: 'transient', code: e.code };
  return { category: 'permanent', code: 'SEND_FAILED' };
}

@Injectable()
export class NotificationsService implements OnApplicationShutdown {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly queue: NotificationMessage[] = [];
  private readonly stop = new AbortController();
  private active = false;
  private outstanding = 0;
  private closing = false;
  private readonly waiters = new Set<() => void>();
  constructor(
    @Inject(NOTIFICATION_TRANSPORT)
    private readonly transport: NotificationTransport,
    @Inject(NOTIFICATION_OPTIONS) private readonly options: NotificationOptions,
    @Inject(NotificationScheduler)
    private readonly scheduler: NotificationScheduler,
  ) {}

  async send(input: NotificationInput): Promise<NotificationResult> {
    try {
      if (this.closing) return this.reject('shutting_down');
      let message: NotificationMessage;
      try {
        message = renderNotification(input);
      } catch {
        return this.reject('invalid_input');
      }
      // Capacity includes the active message and its retries, bounding all retained messages.
      if (this.outstanding >= this.options.queueCapacity)
        return this.reject('queue_full', message);
      this.queue.push(message);
      this.outstanding++;
      if (!this.active) {
        this.active = true;
        // Defer delivery until after enqueue; always observe the background promise.
        void Promise.resolve()
          .then(() => this.work())
          .catch(() => {
            this.log('error', {
              event: 'notification_worker_failed',
              code: 'WORKER_FAILED',
            });
            this.queue.length = 0;
            this.outstanding = 0;
            this.active = false;
            this.resolveDrain();
          });
      }
      return { accepted: true };
    } catch {
      return this.reject('internal_error');
    }
  }
  private reject(
    reason: string,
    message?: NotificationMessage,
  ): NotificationResult {
    this.log('error', {
      event: 'notification_rejected',
      reason,
      ...(message
        ? { template: message.template, to: maskRecipient(message.to) }
        : {}),
    });
    return { accepted: false, reason };
  }
  private log(level: 'warn' | 'error', value: object): void {
    try {
      this.logger[level](value);
    } catch {
      /* Logging must never reject a business caller. */
    }
  }
  private async work(): Promise<void> {
    while (this.queue.length && !this.stop.signal.aborted) {
      const message = this.queue.shift()!;
      for (
        let attempt = 1;
        attempt <= this.options.maxAttempts && !this.stop.signal.aborted;
        attempt++
      ) {
        try {
          await this.deliver(message);
          break;
        } catch (error) {
          if (this.stop.signal.aborted) break;
          const failure = classifyFailure(error);
          const fields = {
            event: 'notification_failed',
            template: message.template,
            to: maskRecipient(message.to),
            attempt,
            ...failure,
          };
          this.log('warn', fields);
          if (
            ['permanent', 'auth'].includes(failure.category) ||
            attempt === this.options.maxAttempts
          ) {
            this.log('error', { ...fields, final: true });
            break;
          }
          await this.scheduler.wait(
            this.options.retryBaseDelayMs * 2 ** (attempt - 1),
            this.stop.signal,
          );
        }
      }
      this.outstanding = Math.max(0, this.outstanding - 1);
    }
    this.active = false;
    this.resolveDrain();
  }
  private async deliver(message: NotificationMessage): Promise<void> {
    const attempt = new AbortController();
    const timer = new AbortController();
    const stopped = new Promise<void>((resolve) => {
      const abort = () => {
        attempt.abort();
        resolve();
      };
      this.stop.signal.addEventListener('abort', abort, { once: true });
      attempt.signal.addEventListener(
        'abort',
        () => this.stop.signal.removeEventListener('abort', abort),
        { once: true },
      );
    });
    try {
      await Promise.race([
        Promise.resolve().then(() =>
          this.transport.send(message, attempt.signal),
        ),
        this.scheduler
          .wait(this.options.sendTimeoutMs, timer.signal)
          .then(() => {
            if (!timer.signal.aborted) throw TIMEOUT;
          }),
        stopped,
      ]);
    } finally {
      timer.abort();
      attempt.abort();
    }
  }
  drain(): Promise<void> {
    if (!this.active && !this.queue.length) return Promise.resolve();
    return new Promise((resolve) => this.waiters.add(resolve));
  }
  private resolveDrain(): void {
    for (const resolve of this.waiters) resolve();
    this.waiters.clear();
  }
  async onApplicationShutdown(): Promise<void> {
    this.closing = true;
    const grace = new AbortController();
    await Promise.race([
      this.drain(),
      this.scheduler.wait(this.options.shutdownTimeoutMs, grace.signal),
    ]);
    grace.abort();
    const dropped = this.outstanding;
    if (dropped)
      this.log('error', { event: 'notification_shutdown_dropped', dropped });
    this.stop.abort();
    this.queue.length = 0;
    this.outstanding = 0;
    this.active = false;
    this.resolveDrain();
  }
}
