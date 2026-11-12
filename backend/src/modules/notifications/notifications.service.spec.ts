import { Logger } from '@nestjs/common';
import { notificationConfiguration } from '../../config/notifications.config.js';
import { NotificationScheduler } from './notification.scheduler.js';
import {
  classifyFailure,
  NotificationsService,
} from './notifications.service.js';
import type { NotificationInput } from './notification.types.js';

export const sample: NotificationInput = {
  to: 'alice@example.com',
  template: 'BOOKING_CANCELLATION',
  data: {
    bookingCode: 'GE-123',
    guestName: 'Alice',
    checkIn: '2026-10-24',
    checkOut: '2026-10-25',
    cancelledAt: new Date('2026-10-23T18:00:00Z'),
  },
};
describe('H9 background queue', () => {
  it('classifies Brevo authentication failures without exposing provider details', () => {
    expect(classifyFailure({ code: 'EAUTH' })).toEqual({
      category: 'auth',
      code: 'BREVO_AUTH',
      hint: 'Check BREVO_API_KEY and the verified GMAIL_USER sender address',
    });
  });
  let send: ReturnType<typeof vi.fn>;
  let service: NotificationsService;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  const setup = (extra = {}) =>
    new NotificationsService(
      { send },
      { ...notificationConfiguration({}), ...extra },
      new NotificationScheduler(),
    );
  beforeEach(() => {
    vi.useFakeTimers();
    send = vi.fn().mockResolvedValue(undefined);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    service = setup();
  });
  afterEach(async () => {
    const close = service.onApplicationShutdown();
    await vi.runAllTimersAsync();
    await close;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it('succeeds once and drains with no remaining timers', async () => {
    await expect(service.send(sample)).resolves.toEqual({ accepted: true });
    await service.drain();
    expect(send).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('persists SENT and FAILED states and deduplicates a related event', async () => {
    const log = {
      _id: '507f1f77bcf86cd799439011',
      recipient: 'alice@example.com',
      type: 'booking-cancelled',
      subject: 'cancelled',
      payload: { html: '<p>cancelled</p>', text: 'cancelled' },
      retryCount: 0,
    };
    const logs = {
      findOne: vi.fn().mockReturnValue({ lean: () => Promise.resolve(null) }),
      create: vi.fn().mockResolvedValue(log),
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    service = new NotificationsService(
      { send },
      { ...notificationConfiguration({}), maxAttempts: 1 },
      new NotificationScheduler(),
    );
    (service as unknown as { logs: typeof logs }).logs = logs;
    const input: NotificationInput = {
      to: 'alice@example.com',
      type: 'booking-cancelled',
      relatedBookingId: '507f1f77bcf86cd799439012',
      data: {
        bookingCode: 'GE-1',
        guestName: 'Alice',
        checkIn: '2026-10-24',
        checkOut: '2026-10-25',
        cancelledAt: '2026-10-23',
      },
    };
    await service.send(input);
    await service.drain();
    await service.send(input);
    await service.drain();
    expect(send).toHaveBeenCalledTimes(1);
    expect(logs.updateOne).toHaveBeenCalledWith(
      { _id: log._id },
      { $set: expect.objectContaining({ status: 'SENT' }) },
    );
    send.mockRejectedValue(new Error('Brevo request failed'));
    await service.send({
      ...input,
      relatedBookingId: '507f1f77bcf86cd799439013',
    });
    await vi.runAllTimersAsync();
    await service.drain();
    expect(logs.updateOne).toHaveBeenCalledWith(
      { _id: log._id },
      {
        $set: expect.objectContaining({
          status: 'FAILED',
          lastError: 'SEND_FAILED',
        }),
      },
    );
  });
  it('queues only due FAILED logs under the retry limit', async () => {
    const dueLog = {
      _id: '507f1f77bcf86cd799439014',
      recipient: 'alice@example.com',
      type: 'booking-cancelled',
      subject: 'cancelled',
      payload: { html: '<p>cancelled</p>', text: 'cancelled' },
      retryCount: 0,
    };
    const logs = {
      find: vi.fn().mockReturnValue({
        limit: () => ({ lean: () => ({ exec: async () => [dueLog] }) }),
      }),
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    service = new NotificationsService(
      { send },
      notificationConfiguration({}),
      new NotificationScheduler(),
    );
    (service as unknown as { logs: typeof logs }).logs = logs;
    await expect(service.retryFailedNotifications()).resolves.toBe(1);
    await service.drain();
    expect(logs.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', retryCount: { $lt: 3 } }),
    );
    expect(logs.updateOne).toHaveBeenCalledWith(
      { _id: dueLog._id, status: 'FAILED' },
      { $set: { status: 'PENDING' }, $inc: { retryCount: 1 } },
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('returns acceptance without waiting for delivery; bounds active plus pending messages and snapshots data', async () => {
    send.mockImplementation(() => new Promise(() => {}));
    service = setup({ queueCapacity: 2 });
    const input = structuredClone(sample);
    await expect(service.send(input)).resolves.toEqual({ accepted: true });
    input.data.guestName = 'mutated';
    await expect(service.send(sample)).resolves.toEqual({ accepted: true });
    await expect(service.send(sample)).resolves.toEqual({
      accepted: false,
      reason: 'queue_full',
    });
    expect(send.mock.calls[0][0].text).toContain('Alice');
    expect(send.mock.calls[0][0].text).not.toContain('mutated');
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('retries after exactly 1000 then 2000ms and resolves drain only after all retries', async () => {
    send
      .mockRejectedValueOnce({ code: 'ECONNECTION' })
      .mockRejectedValueOnce({ code: 'ECONNRESET' })
      .mockResolvedValue(undefined);
    await service.send(sample);
    const drained = vi.fn();
    void service.drain().then(drained);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(send).toHaveBeenCalledTimes(2);
    expect(drained).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await service.drain();
    expect(send).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(error).not.toHaveBeenCalled();
  });
  it('exhausts three attempts, warning each time and logging final error without untrusted details', async () => {
    send.mockRejectedValue({
      code: 'ECONNECTION',
      message: 'app-password alice@example.com FULL BODY',
      response: 'secret',
    });
    await expect(service.send(sample)).resolves.toEqual({ accepted: true });
    await vi.runAllTimersAsync();
    await service.drain();
    expect(send).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 3,
        final: true,
        to: 'a***@example.com',
        category: 'transient',
      }),
    );
    const logs = JSON.stringify([warn.mock.calls, error.mock.calls]);
    for (const secret of [
      'app-password',
      'alice@example.com',
      'FULL BODY',
      'secret',
    ])
      expect(logs).not.toContain(secret);
  });
  it.each([
    [550, 'permanent'],
    [535, 'auth'],
  ])(
    'does not retry Brevo permanent failure %s',
    async (responseCode, category) => {
      send.mockRejectedValue(
        Object.assign(new Error('Brevo rejected the request'), {
          code: responseCode === 535 ? 'EAUTH' : 'SEND_FAILED',
        }),
      );
      await service.send(sample);
      await vi.runAllTimersAsync();
      await service.drain();
      expect(send).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ category, final: true }),
      );
      if (responseCode === 535)
        expect(error).toHaveBeenCalledWith(
          expect.objectContaining({
            hint: expect.stringContaining('BREVO_API_KEY'),
          }),
        );
    },
  );
  it('retries timeouts and aborts the expired attempt', async () => {
    send
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue(undefined);
    await service.send(sample);
    await vi.advanceTimersByTimeAsync(10000);
    expect(send.mock.calls[0][1].aborted).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'timeout' }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await service.drain();
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('contains synchronous transport throws and logger exceptions', async () => {
    send.mockImplementation(() => {
      throw new Error('untrusted body');
    });
    warn.mockImplementation(() => {
      throw new Error('logger');
    });
    error.mockImplementation(() => {
      throw new Error('logger');
    });
    await expect(service.send(sample)).resolves.toEqual({ accepted: true });
    await service.drain();
    expect(send).toHaveBeenCalledTimes(1);
    await expect(service.send(null as never)).resolves.toEqual({
      accepted: false,
      reason: 'invalid_input',
    });
  });
  it.each([
    null,
    { ...sample, to: 'invalid' },
    { ...sample, to: 'a@example.com\r\nBcc: b@example.com' },
    { ...sample, to: 'a@example.com,b@example.com' },
    { ...sample, template: 'UNKNOWN' },
    { ...sample, data: {} },
    { ...sample, data: { ...sample.data, cancelledAt: '2026-02-30' } },
  ])('rejects invalid input without sending or echoing it', async (input) => {
    await expect(service.send(input as never)).resolves.toEqual({
      accepted: false,
      reason: 'invalid_input',
    });
    expect(send).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith({
      event: 'notification_rejected',
      reason: 'invalid_input',
    });
  });
  it('shutdown waits for drain, including retry, then rejects new messages', async () => {
    send
      .mockRejectedValueOnce({ code: 'ECONNECTION' })
      .mockResolvedValue(undefined);
    await service.send(sample);
    const closed = vi.fn();
    const shutdown = service.onApplicationShutdown().then(closed);
    await vi.advanceTimersByTimeAsync(999);
    expect(closed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await shutdown;
    expect(send).toHaveBeenCalledTimes(2);
    await expect(service.send(sample)).resolves.toEqual({
      accepted: false,
      reason: 'shutting_down',
    });
    expect(error).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'notification_shutdown_dropped' }),
    );
  });
  it('shutdown deadline drops active and queued messages and suppresses all future retries', async () => {
    send.mockImplementation(() => new Promise(() => {}));
    service = setup({ shutdownTimeoutMs: 50 });
    await service.send(sample);
    await service.send(sample);
    const shutdown = service.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(50);
    await shutdown;
    await service.drain();
    expect(error).toHaveBeenCalledWith({
      event: 'notification_shutdown_dropped',
      dropped: 2,
    });
    expect(send.mock.calls[0][1].aborted).toBe(true);
    await vi.runAllTimersAsync();
    expect(send).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
