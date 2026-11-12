import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingListItem, SameDayList } from './api'
import { todayISO } from './utils'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const row = (
  id: string,
  code: string,
  status: string,
  overrides: Partial<BookingListItem> = {},
): BookingListItem => ({
  id,
  code,
  status,
  guestName: `Khách ${code}`,
  guestEmail: `${code.toLowerCase()}@example.test`,
  guestPhone: '0900000001',
  rooms: [{ id: `room-${id}`, roomNumber: '102', roomTypeName: 'Deluxe' }],
  checkIn: '2099-01-09T17:00:00.000Z',
  checkOut: '2099-01-11T17:00:00.000Z',
  adultCount: 2,
  childCount: 1,
  source: 'FRONT_DESK',
  roomTotal: 2_000_000,
  createdAt: '2099-01-01T00:00:00.000Z',
  walkIn: true,
  depositAmount: 200_000,
  depositPaid: false,
  ...overrides,
})

const list = (arrivals: BookingListItem[]): SameDayList => ({
  date: todayISO(),
  summary: {
    arrivals: { total: arrivals.length, awaitingDeposit: 0, ready: arrivals.length, checkedIn: 0 },
    departures: { total: 0, awaitingCheckOut: 0, checkedOut: 0 },
  },
  arrivals,
  departures: [],
})

const failure = (message: string) => ({
  isAxiosError: true,
  response: { status: 409, data: { message } },
})

function mockGet(arrivals: BookingListItem[]) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/front-desk/same-day') return { data: list(arrivals) }
    throw new Error(`unexpected GET ${url}`)
  })
}

function renderPage() {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/front-desk',
    auth: { me: receptionist, status: 'authenticated' },
  })
}

const arrival = () => within(screen.getByRole('listitem', { name: 'ARC' }))
const dialog = () => within(screen.getByRole('dialog'))

async function openDepositDialog() {
  renderPage()
  await screen.findByRole('heading', { name: 'Khách đến (1)' })
  fireEvent.click(arrival().getByRole('button', { name: 'Thu cọc' }))
  await screen.findByRole('dialog')
}

describe('Arrivals who have not paid the deposit', () => {
  it('asks for the deposit instead of offering Check In', async () => {
    mockGet([row('a2', 'ARC', 'CONFIRMED')])
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (1)' })

    expect(arrival().getByText(/Chưa đóng cọc/)).toHaveTextContent('200.000')
    expect(arrival().getByRole('button', { name: 'Thu cọc' })).toBeInTheDocument()
    expect(arrival().getByRole('button', { name: 'Nhả phòng' })).toBeInTheDocument()
    expect(arrival().queryByRole('button', { name: 'Check In' })).not.toBeInTheDocument()
  })

  it('offers Check In once the deposit is paid', async () => {
    mockGet([row('a2', 'ARC', 'CONFIRMED', { depositPaid: true })])
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (1)' })

    expect(arrival().getByRole('button', { name: 'Check In' })).toBeInTheDocument()
    expect(arrival().queryByRole('button', { name: 'Thu cọc' })).not.toBeInTheDocument()
    expect(arrival().queryByText(/Chưa đóng cọc/)).not.toBeInTheDocument()
  })

  it('offers Check In when no deposit is due', async () => {
    mockGet([row('a2', 'ARC', 'CONFIRMED', { depositAmount: 0 })])
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (1)' })

    expect(arrival().getByRole('button', { name: 'Check In' })).toBeInTheDocument()
    expect(arrival().queryByRole('button', { name: 'Thu cọc' })).not.toBeInTheDocument()
  })

  it('records a cash deposit for the amount due, then reloads the list', async () => {
    const get = mockGet([row('a2', 'ARC', 'CONFIRMED')])
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    await openDepositDialog()
    const before = get.mock.calls.length

    expect(dialog().getByText(/200\.000/)).toBeInTheDocument()
    fireEvent.change(dialog().getByLabelText(/Hình thức thu cọc/), { target: { value: 'CASH' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Xác nhận thu cọc' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/a2/payments/deposit', {
        method: 'CASH',
        requestId: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/),
      }),
    )
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(before))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('records a card deposit', async () => {
    mockGet([row('a2', 'ARC', 'CONFIRMED')])
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    await openDepositDialog()

    fireEvent.change(dialog().getByLabelText(/Hình thức thu cọc/), { target: { value: 'CARD' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Xác nhận thu cọc' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/a2/payments/deposit', {
        method: 'CARD',
        requestId: expect.any(String),
      }),
    )
  })

  it('needs a payment method before it can be confirmed', async () => {
    mockGet([row('a2', 'ARC', 'CONFIRMED')])
    const post = vi.spyOn(api, 'post')
    await openDepositDialog()

    expect(dialog().getByRole('button', { name: 'Xác nhận thu cọc' })).toBeDisabled()
    expect(post).not.toHaveBeenCalled()
  })

  it('opens the VNPay page for the guest to pay the deposit', async () => {
    mockGet([row('a2', 'ARC', 'CONFIRMED')])
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { transactionRef: 'TXN-DEP', paymentUrl: 'https://vnpay.test/pay', amount: 200_000 },
    })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    await openDepositDialog()

    fireEvent.change(dialog().getByLabelText(/Hình thức thu cọc/), { target: { value: 'VNPAY' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Mở trang VNPay' }))

    await waitFor(() => expect(post).toHaveBeenCalledWith('/payments/deposit', { bookingId: 'a2' }))
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith('https://vnpay.test/pay', '_blank', 'noopener'),
    )
    expect(await dialog().findByText(/Đã mở trang VNPay/)).toBeInTheDocument()
    expect(post).not.toHaveBeenCalledWith('/bookings/a2/payments/deposit', expect.anything())
  })

  it('shows the server error and keeps the dialog open', async () => {
    mockGet([row('a2', 'ARC', 'CONFIRMED')])
    vi.spyOn(api, 'post').mockRejectedValue(failure('The deposit has already been paid'))
    await openDepositDialog()

    fireEvent.change(dialog().getByLabelText(/Hình thức thu cọc/), { target: { value: 'CASH' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Xác nhận thu cọc' }))

    expect(await dialog().findByRole('alert')).toHaveTextContent('already been paid')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('releases the room after a confirmation, cancelling the booking', async () => {
    const get = mockGet([row('a2', 'ARC', 'CONFIRMED')])
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (1)' })
    const before = get.mock.calls.length

    fireEvent.click(arrival().getByRole('button', { name: 'Nhả phòng' }))
    const confirm = within(await screen.findByRole('alertdialog'))
    expect(confirm.getByText(/chưa đóng cọc/i)).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
    fireEvent.click(confirm.getByRole('button', { name: 'Nhả phòng' }))

    await waitFor(() => expect(post).toHaveBeenCalledWith('/bookings/a2/cancel', {}))
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(before))
  })

  it('keeps the booking when the receptionist backs out of releasing the room', async () => {
    mockGet([row('a2', 'ARC', 'CONFIRMED')])
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    renderPage()
    await screen.findByRole('heading', { name: 'Khách đến (1)' })

    fireEvent.click(arrival().getByRole('button', { name: 'Nhả phòng' }))
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Giữ lại' }),
    )

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(post).not.toHaveBeenCalled()
  })
})
