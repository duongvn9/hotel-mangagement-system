import { BookingStatus } from '../../common/constants/booking-status.enum.js';

/** Lý do booking không check-out được, null nếu khách đang ở (CHECKED_IN). */
export function checkOutStatusError(status: BookingStatus): string | null {
  switch (status) {
    case BookingStatus.CheckedIn:
      return null;
    case BookingStatus.PendingDeposit:
    case BookingStatus.Confirmed:
      return 'The guest has not checked in yet';
    case BookingStatus.CheckedOut:
      return 'Booking is already checked out';
    default:
      return 'This booking cannot be checked out';
  }
}

export function unpaidBalanceMessage(balanceDue: number): string {
  return `Invoice not fully paid: ${balanceDue} VND still due`;
}
