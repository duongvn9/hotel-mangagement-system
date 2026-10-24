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
  it('treats temporary SMTP auth unavailability as 4xx rather than permanent bad credentials', () => {
    expect(classifyFailure({ code: 'EAUTH', responseCode: 454 })).toEqual({
      category: 'transient',
      code: 'SMTP_454',
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
      .mockRejectedValueOnce({ responseCode: 421 })
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
  ])('does not retry SMTP %s', async (responseCode, category) => {
    send.mockRejectedValue({ responseCode });
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
          hint: expect.stringContaining('App Password'),
        }),
      );
  });
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
      .mockRejectedValueOnce({ responseCode: 450 })
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
