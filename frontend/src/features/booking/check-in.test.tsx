import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingListItem, CheckInOptions, SameDayList } from './api'
import { todayISO } from './utils'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const row = (id: string, code: string, status: string, room: string): BookingListItem => ({
  id,
  code,
  status,
  guestName: `Khách ${code}`,
  guestEmail: `${code.toLowerCase()}@example.test`,
  guestPhone: '0900000001',
  rooms: [{ id: `room-${id}`, roomNumber: room, roomTypeName: 'Deluxe' }],
  checkIn: '2099-01-09T17:00:00.000Z',
  checkOut: '2099-01-11T17:00:00.000Z',
  adultCount: 2,
  childCount: 1,
  source: 'ONLINE',
  roomTotal: 2_000_000,
  createdAt: '2099-01-01T00:00:00.000Z',
  walkIn: false,
})

const list = (): SameDayList => ({
  date: todayISO(),
  summary: {
    arrivals: { total: 3, awaitingDeposit: 1, ready: 1, checkedIn: 1 },
    departures: { total: 1, awaitingCheckOut: 1, checkedOut: 0 },
  },
  arrivals: [
    row('a1', 'ARP', 'PENDING_DEPOSIT', '101'),
    row('a2', 'ARC', 'CONFIRMED', '102'),
    row('a3', 'ARI', 'CHECKED_IN', '103'),
  ],
  departures: [row('d1', 'DPI', 'CHECKED_IN', '201')],
})

const options = (
  replacements: { id: string; roomNumber: string; floor: number }[],
): CheckInOptions => ({
  bookingId: 'a2',
  code: 'ARC',
  rooms: [
    {
      id: 'room-a2',
      roomNumber: '102',
      roomTypeName: 'Deluxe',
      ready: false,
      status: 'CLEANING',
      replacements,
    },
  ],
})

const conflict = (message: string) => ({
  isAxiosError: true,
  response: { status: 409, data: { message } },
})

function renderPage() {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/front-desk',
    auth: { me: receptionist, status: 'authenticated' },
  })
}

function mockGet(checkInOptions?: CheckInOptions) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/front-desk/same-day') return { data: list() }
    if (url === '/bookings/a2/check-in-options' && checkInOptions) return { data: checkInOptions }
    throw new Error(`unexpected GET ${url}`)
  })
}

const arrival = () => within(screen.getByRole('listitem', { name: 'ARC' }))

describe('Check In from the same-day list', () => {
  it('shows the Check In button only for confirmed arrivals', async () => {
    mockGet()
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })
    expect(screen.getAllByRole('button', { name: 'Check In' })).toHaveLength(1)
    expect(arrival().getByRole('button', { name: 'Check In' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'ARP' })).queryByRole('button', {
        name: 'Check In',
      }),
    ).not.toBeInTheDocument()
  })

  it('checks the guest in and reloads the list', async () => {
    const get = mockGet()
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'a2' } })
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })
    const before = get.mock.calls.length

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/bookings/a2/check-in', {}))
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(before))
  })

  it('offers replacement rooms when a room is not ready and checks in with the swap', async () => {
    mockGet(
      options([
        { id: 'room-x', roomNumber: '103', floor: 1 },
        { id: 'room-y', roomNumber: '104', floor: 1 },
      ]),
    )
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(conflict('Rooms not ready: 102 (CLEANING)'))
      .mockResolvedValue({ data: { id: 'a2' } })
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    expect(await arrival().findByText(/Phòng 102 đang dọn/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Rooms not ready: 102 (CLEANING)')

    const confirm = arrival().getByRole('button', { name: 'Đổi phòng và Check In' })
    expect(confirm).toBeDisabled()
    fireEvent.change(arrival().getByLabelText(/Thay phòng 102 bằng/), {
      target: { value: 'room-y' },
    })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith('/bookings/a2/check-in', {
        replacements: [{ from: 'room-a2', to: 'room-y' }],
      }),
    )
  })

  it('explains when no replacement room is available', async () => {
    mockGet(options([]))
    vi.spyOn(api, 'post').mockRejectedValue(conflict('Rooms not ready: 102 (CLEANING)'))
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    expect(await arrival().findByText(/Không có phòng thay thế phù hợp/)).toBeInTheDocument()
    expect(arrival().getByRole('button', { name: 'Đổi phòng và Check In' })).toBeDisabled()
  })

  it('shows other errors without the replacement panel', async () => {
    mockGet({
      bookingId: 'a2',
      code: 'ARC',
      rooms: [
        {
          id: 'room-a2',
          roomNumber: '102',
          roomTypeName: 'Deluxe',
          ready: true,
          status: 'AVAILABLE',
          replacements: [],
        },
      ],
    })
    vi.spyOn(api, 'post').mockRejectedValue(
      conflict('Too early to check in: arrival date is 2099-01-10'),
    )
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Check In' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too early to check in')
    expect(
      arrival().queryByRole('button', { name: 'Đổi phòng và Check In' }),
    ).not.toBeInTheDocument()
  })
})
