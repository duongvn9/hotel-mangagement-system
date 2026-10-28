import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingListItem, SameDayList } from './api'
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

const list = (date = todayISO()): SameDayList => ({
  date,
  summary: {
    arrivals: { total: 3, awaitingDeposit: 1, ready: 1, checkedIn: 1 },
    departures: { total: 2, awaitingCheckOut: 1, checkedOut: 1 },
  },
  arrivals: [
    row('a1', 'ARP', 'PENDING_DEPOSIT', '101'),
    row('a2', 'ARC', 'CONFIRMED', '102'),
    row('a3', 'ARI', 'CHECKED_IN', '103'),
  ],
  departures: [row('d1', 'DPI', 'CHECKED_IN', '201'), row('d2', 'DPO', 'CHECKED_OUT', '202')],
})

function renderPage(role = receptionist) {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/front-desk',
    auth: { me: role, status: 'authenticated' },
  })
}

describe('FrontDeskPage', () => {
  it('blocks roles other than receptionist/manager', () => {
    renderPage({ ...receptionist, role: 'CUSTOMER' })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('lists arrivals and departures with summary chips and statuses', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: list() })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Khách đến (3)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Khách đi (2)' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/front-desk/same-day', { params: { date: todayISO() } })

    const arrivalChips = within(screen.getByLabelText('Tổng hợp khách đến'))
    expect(arrivalChips.getByText('Chưa cọc: 1')).toBeInTheDocument()
    expect(arrivalChips.getByText('Sẵn sàng: 1')).toBeInTheDocument()
    expect(arrivalChips.getByText('Đã nhận phòng: 1')).toBeInTheDocument()
    const departureChips = within(screen.getByLabelText('Tổng hợp khách đi'))
    expect(departureChips.getByText('Chờ trả phòng: 1')).toBeInTheDocument()
    expect(departureChips.getByText('Đã trả phòng: 1')).toBeInTheDocument()

    const pending = within(screen.getByRole('listitem', { name: 'ARP' }))
    expect(pending.getByText(/Khách ARP/)).toBeInTheDocument()
    expect(pending.getByText(/101 · Deluxe/)).toBeInTheDocument()
    expect(pending.getByText('Chờ đặt cọc')).toBeInTheDocument()
    expect(pending.getByText('Chưa đặt cọc')).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'ARC' })).getByText('Đã xác nhận'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'ARC' })).queryByText('Chưa đặt cọc'),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('listitem', { name: 'DPO' })).getByText('Đã trả phòng'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ARC/ })).toHaveAttribute('href', '/booking/a2')
  })

  it('reloads for another day', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: list() })
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (3)' })

    fireEvent.change(screen.getByLabelText(/^Ngày/), { target: { value: '2099-01-10' } })
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/front-desk/same-day', {
        params: { date: '2099-01-10' },
      }),
    )
  })

  it('shows empty lists and an error state', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      data: {
        ...list(),
        summary: {
          arrivals: { total: 0, awaitingDeposit: 0, ready: 0, checkedIn: 0 },
          departures: { total: 0, awaitingCheckOut: 0, checkedOut: 0 },
        },
        arrivals: [],
        departures: [],
      },
    })
    const empty = renderPage()
    expect(await screen.findByText('Không có khách đến.')).toBeInTheDocument()
    expect(screen.getByText('Không có khách đi.')).toBeInTheDocument()
    empty.unmount()

    vi.spyOn(api, 'get').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Boom' } },
    })
    renderPage()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
