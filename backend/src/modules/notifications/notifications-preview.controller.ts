import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator.js';
import { renderNotification } from './notification.templates.js';
import type { NotificationTemplate } from './notification.types.js';

const PREVIEW_TYPES: NotificationTemplate[] = [
  'booking-confirmed',
  'deposit-paid',
  'final-payment-paid',
  'booking-cancelled',
];

@Public()
@Controller('dev/notifications')
export class NotificationsPreviewController {
  constructor(private readonly config: ConfigService) {}

  @Get('preview/:type')
  @Header('Content-Type', 'text/html; charset=utf-8')
  preview(@Param('type') type: string): string {
    if (
      this.config.get('env') === 'production' ||
      !PREVIEW_TYPES.includes(type as NotificationTemplate)
    )
      throw new NotFoundException();
    const common = { bookingCode: 'GE-2026-001', guestName: 'Nguyễn An' };
    const samples = {
      'booking-confirmed': {
        ...common,
        room: 'Phòng Deluxe · 301',
        checkIn: new Date('2026-11-12T07:00:00Z'),
        checkOut: new Date('2026-11-15T05:00:00Z'),
        nights: 3,
        guests: 2,
        total: 3750000,
        depositStatus: 'pending' as const,
        depositAmount: 1000000,
      },
      'deposit-paid': {
        ...common,
        transactionRef: 'VN-2026-001',
        amount: 1000000,
        paidAt: new Date('2026-11-10T04:30:00Z'),
        bookingState: 'CONFIRMED',
      },
      'final-payment-paid': {
        ...common,
        transactionRef: 'VN-2026-002',
        amount: 2750000,
        paidAt: new Date('2026-11-15T05:00:00Z'),
        bookingState: 'CHECKED_OUT',
        outstandingBalance: 0,
        roomCharges: 3750000,
        serviceCharges: 250000,
        additionalCharges: 0,
        discounts: 250000,
        total: 3750000,
      },
      'booking-cancelled': {
        ...common,
        checkIn: new Date('2026-11-12T07:00:00Z'),
        checkOut: new Date('2026-11-15T05:00:00Z'),
        cancelledAt: new Date('2026-11-10T04:30:00Z'),
      },
    };
    const selected = type as keyof typeof samples;
    return renderNotification({
      to: 'preview@example.com',
      type: selected,
      data: samples[selected],
    } as Parameters<typeof renderNotification>[0]).html;
  }
}
