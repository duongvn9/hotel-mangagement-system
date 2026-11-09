import { classifyAttention } from './attention'

const today = '2026-11-10'
const at = (day: string) => `${day}T12:00:00+07:00`

test('flags overdue checkout for checked-in bookings past their checkout date', () => {
  expect(
    classifyAttention(
      { status: 'CHECKED_IN', checkIn: at('2026-11-07'), checkOut: at('2026-11-09') },
      today,
    ),
  ).toBe('overdueCheckOut')
})

test('flags checkout due today', () => {
  expect(
    classifyAttention(
      { status: 'CHECKED_IN', checkIn: at('2026-11-09'), checkOut: at('2026-11-10') },
      today,
    ),
  ).toBe('dueCheckOut')
})

test('flags overdue check-in (no-show) for confirmed bookings past their check-in date', () => {
  expect(
    classifyAttention(
      { status: 'CONFIRMED', checkIn: at('2026-11-08'), checkOut: at('2026-11-11') },
      today,
    ),
  ).toBe('overdueCheckIn')
})

test('flags check-in due today', () => {
  expect(
    classifyAttention(
      { status: 'CONFIRMED', checkIn: at('2026-11-10'), checkOut: at('2026-11-12') },
      today,
    ),
  ).toBe('dueCheckIn')
})

test('returns null for bookings that need no attention', () => {
  expect(
    classifyAttention(
      { status: 'CHECKED_IN', checkIn: at('2026-11-10'), checkOut: at('2026-11-12') },
      today,
    ),
  ).toBeNull()
  expect(
    classifyAttention(
      { status: 'CONFIRMED', checkIn: at('2026-11-12'), checkOut: at('2026-11-14') },
      today,
    ),
  ).toBeNull()
  expect(
    classifyAttention(
      { status: 'CHECKED_OUT', checkIn: at('2026-11-01'), checkOut: at('2026-11-03') },
      today,
    ),
  ).toBeNull()
})
