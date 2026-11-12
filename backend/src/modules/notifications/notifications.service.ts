import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';
import {
  NOTIFICATION_OPTIONS,
  type NotificationOptions,
} from '../../config/notifications.config.js';
import { NotificationScheduler } from './notification.scheduler.js';
import {
  NotificationLog,
  NotificationLogSchema,
  NotificationLogStatus,
} from './schemas/notification-log.schema.js';
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
  if (e.code === 'EAUTH')
    return {
      category: 'auth',
      code: 'BREVO_AUTH',
      hint: 'Check BREVO_API_KEY and the verified GMAIL_USER sender address',
    };
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
  private readonly logs?: Model<NotificationLog>;
  private readonly stop = new AbortController();
  private active = false;
  private outstanding = 0;
  private closing = false;
  private retryTimer?: NodeJS.Timeout;
  private readonly waiters = new Set<() => void>();
  private readonly acceptedKeys = new Set<string>();
  constructor(
    @Inject(NOTIFICATION_TRANSPORT)
    private readonly transport: NotificationTransport,
    @Inject(NOTIFICATION_OPTIONS) private readonly options: NotificationOptions,
    @Inject(NotificationScheduler)
    private readonly scheduler: NotificationScheduler,
    @Optional() @InjectConnection() connection?: Connection,
  ) {
    this.logs = connection
      ? ((connection.models[NotificationLog.name] as Model<NotificationLog>) ??
        connection.model<NotificationLog>(
          NotificationLog.name,
          NotificationLogSchema,
        ))
      : undefined;
    if (this.logs) {
      this.retryTimer = setInterval(() => {
        void this.retryFailedNotifications().catch(() => undefined);
      }, 60_000);
      this.retryTimer.unref();
    }
  }

  async send(input: NotificationInput): Promise<NotificationResult> {
    try {
      if (this.closing) return this.reject('shutting_down');
      let message: NotificationMessage;
      try {
        message = renderNotification(input, {
          logoUrl: this.options.logoUrl,
          bannerUrl: this.options.bannerUrl,
          appBaseUrl: this.options.appBaseUrl,
        });
      } catch {
        return this.reject('invalid_input');
      }
      const kind = input.template ?? input.type;
      const relatedId = input.relatedPaymentId ?? input.relatedBookingId;
      const idempotencyKey =
        kind && relatedId ? `${kind}:${relatedId}` : undefined;
      if (idempotencyKey && this.acceptedKeys.has(idempotencyKey))
        return { accepted: true };
      // Capacity includes the active message and its retries, bounding all retained messages.
      if (this.outstanding >= this.options.queueCapacity)
        return this.reject('queue_full', message);
      if (idempotencyKey && this.logs) {
        try {
          const existing = await this.logs.findOne({ idempotencyKey }).lean();
          if (existing) {
            this.acceptedKeys.add(idempotencyKey);
            return { accepted: true };
          }
          const log = await this.logs.create({
            type: kind,
            recipient: message.to,
            relatedBookingId: input.relatedBookingId,
            relatedPaymentId: input.relatedPaymentId,
            status: NotificationLogStatus.Pending,
            retryCount: 0,
            subject: message.subject,
            payload: { html: message.html, text: message.text },
            idempotencyKey,
          });
          message.notificationLogId = String(log._id);
          message.notificationLogRetryCount = 0;
        } catch (error) {
          if ((error as { code?: number }).code === 11000) {
            this.acceptedKeys.add(idempotencyKey);
            return { accepted: true };
          }
          this.log('error', {
            event: 'notification_log_failed',
            code: 'LOG_WRITE_FAILED',
          });
          return { accepted: false, reason: 'log_write_failed' };
        }
      }
      this.queue.push(message);
      if (idempotencyKey) this.acceptedKeys.add(idempotencyKey);
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
          await this.updateLog(message, {
            status: NotificationLogStatus.Sent,
            sentAt: new Date(),
            lastError: undefined,
          });
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
          await this.updateLog(message, {
            lastError: failure.code,
            ...(['permanent', 'auth'].includes(failure.category) ||
            attempt === this.options.maxAttempts
              ? {
                  status: NotificationLogStatus.Failed,
                  nextRetryAt: new Date(
                    Date.now() +
                      [60_000, 300_000, 900_000][
                        Math.min(message.notificationLogRetryCount ?? 0, 2)
                      ]!,
                  ),
                }
              : {}),
          });
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
  private async updateLog(
    message: NotificationMessage,
    update: Record<string, unknown>,
  ): Promise<void> {
    if (!this.logs || !message.notificationLogId) return;
    try {
      await this.logs.updateOne(
        { _id: message.notificationLogId },
        { $set: update },
      );
    } catch {
      this.log('error', {
        event: 'notification_log_update_failed',
        code: 'LOG_UPDATE_FAILED',
      });
    }
  }
  async retryFailedNotifications(): Promise<number> {
    if (!this.logs || this.closing) return 0;
    const due = await this.logs
      .find({
        status: NotificationLogStatus.Failed,
        retryCount: { $lt: this.options.maxRetries },
        nextRetryAt: { $lte: new Date() },
      })
      .limit(this.options.queueCapacity)
      .lean()
      .exec();
    let queued = 0;
    for (const log of due) {
      if (this.outstanding >= this.options.queueCapacity) break;
      const result = await this.logs.updateOne(
        { _id: log._id, status: NotificationLogStatus.Failed },
        {
          $set: { status: NotificationLogStatus.Pending },
          $inc: { retryCount: 1 },
        },
      );
      if (result.modifiedCount !== 1) continue;
      this.queue.push({
        to: log.recipient,
        template: log.type,
        subject: log.subject,
        html: log.payload.html,
        text: log.payload.text,
        notificationLogId: String(log._id),
        notificationLogRetryCount: log.retryCount + 1,
      });
      this.outstanding++;
      queued++;
    }
    if (queued && !this.active) {
      this.active = true;
      void Promise.resolve()
        .then(() => this.work())
        .catch(() => undefined);
    }
    return queued;
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
    if (this.retryTimer) clearInterval(this.retryTimer);
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
