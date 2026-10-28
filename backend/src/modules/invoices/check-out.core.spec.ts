import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { checkOutStatusError, unpaidBalanceMessage } from './check-out.core.js';

describe('checkOutStatusError', () => {
  it('only allows guests who are checked in', () => {
    expect(checkOutStatusError(BookingStatus.CheckedIn)).toBeNull();
  });

  it('explains why other statuses cannot check out', () => {
    expect(checkOutStatusError(BookingStatus.PendingDeposit)).toMatch(
      /not checked in/i,
    );
    expect(checkOutStatusError(BookingStatus.Confirmed)).toMatch(
      /not checked in/i,
    );
    expect(checkOutStatusError(BookingStatus.CheckedOut)).toMatch(/already/i);
    expect(checkOutStatusError(BookingStatus.Cancelled)).toMatch(/cannot/i);
  });
});

describe('unpaidBalanceMessage', () => {
  it('names the amount that is still due', () => {
    expect(unpaidBalanceMessage(1400000)).toBe(
      'Invoice not fully paid: 1400000 VND still due',
    );
  });
});
