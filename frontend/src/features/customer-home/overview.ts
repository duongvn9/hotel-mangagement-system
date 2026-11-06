import type { MyBookingItem } from '@/features/booking/api'
import { nightsBetween, toBusinessDate } from '@/features/booking/utils'

export interface BookingSummary {
  bookingCount: number
  nightsStayed: number
  /** Tổng đã thanh toán; `undefined` khi API chưa trả `paidAmount` cho booking nào. */
  paidTotal: number | undefined
  next: MyBookingItem | undefined
}

const UNCOUNTED = ['ROOM_HELD', 'CANCELLED', 'EXPIRED']
const UPCOMING = ['CONFIRMED', 'CHECKED_IN', 'PENDING_DEPOSIT']

/** `today` là ngày làm việc YYYY-MM-DD (giờ Việt Nam). */
export function summarizeBookings(bookings: MyBookingItem[], today: string): BookingSummary {
  const counted = bookings.filter((booking) => !UNCOUNTED.includes(booking.status))
  const withPaid = counted.filter((booking) => booking.paidAmount !== undefined)
  const next = bookings
    .filter(
      (booking) => UPCOMING.includes(booking.status) && toBusinessDate(booking.checkOut) >= today,
    )
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0]
  return {
    bookingCount: counted.length,
    nightsStayed: bookings
      .filter((booking) => booking.status === 'CHECKED_OUT')
      .reduce((sum, booking) => sum + nightsBetween(booking.checkIn, booking.checkOut), 0),
    paidTotal:
      withPaid.length === 0
        ? undefined
        : withPaid.reduce((sum, booking) => sum + (booking.paidAmount ?? 0), 0),
    next,
  }
}

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour <= 10) return 'Chào buổi sáng'
  if (hour >= 11 && hour <= 12) return 'Chào buổi trưa'
  if (hour >= 13 && hour <= 17) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

export function givenName(fullName: string): string {
  return fullName.trim().split(/\s+/).at(-1) ?? ''
}
