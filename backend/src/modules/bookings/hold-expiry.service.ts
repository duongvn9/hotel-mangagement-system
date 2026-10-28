import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { BookingsService } from './bookings.service.js';

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Quét định kỳ để backend chủ động nhả hold quá hạn (chuyển booking chưa xác nhận
 * sang EXPIRED), không dựa vào TTL hay countdown ở frontend. Dừng được bằng
 * HOLD_SWEEP_DISABLED=1 (ví dụ khi chạy test).
 */
@Injectable()
export class HoldExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldExpiryService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly bookings: BookingsService) {}

  onModuleInit(): void {
    if (process.env.HOLD_SWEEP_DISABLED === '1') return;
    this.timer = setInterval(() => void this.runOnce(), SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    try {
      const expired = await this.bookings.sweepExpired();
      if (expired > 0) {
        this.logger.log(`Released ${expired} expired booking hold(s)`);
      }
    } catch (error) {
      this.logger.warn(`Hold sweep failed: ${(error as Error).message}`);
    }
  }
}
