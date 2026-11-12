import { ConflictException, type ArgumentsHost } from '@nestjs/common';
import { vi } from 'vitest';
import { AllExceptionsFilter } from './http-exception.filter.js';

it('preserves actionable active-booking conflict metadata in the standard error envelope', () => {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const existingBooking = {
    id: 'booking',
    code: 'BKTEST',
    status: 'ROOM_HELD',
    holdExpiresAt: '2093-01-01',
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ originalUrl: '/api/v1/bookings/hold' }),
    }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(
    new ConflictException({
      message: 'Existing booking',
      code: 'ACTIVE_BOOKING_EXISTS',
      existingBooking,
    }),
    host,
  );
  expect(status).toHaveBeenCalledWith(409);
  expect(json).toHaveBeenCalledWith(
    expect.objectContaining({ code: 'ACTIVE_BOOKING_EXISTS', existingBooking }),
  );
});
