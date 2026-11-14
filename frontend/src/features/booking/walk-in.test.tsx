import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME } from '@/features/auth/test-utils'
import { renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { AvailableRoom } from './api'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const availableRooms: AvailableRoom[] = [
  { id: 'r1', roomTypeId: 't1', roomTypeName: 'Deluxe', pricePerNight: 1_000_000, capacity: 3 },
  { id: 'r2', roomTypeId: 't1', roomTypeName: 'Deluxe', pricePerNight: 1_000_000, capacity: 3 },
]

function renderPage(role = receptionist) {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/booking/new',
    auth: { me: role, status: 'authenticated' },
  })
}

const created = {
  id: 'b1',
  code: 'BKWALK1',
  status: 'CONFIRMED',
  rooms: ['r1'],
  checkIn: '2099-01-10',
  checkOut: '2099-01-12',
  adultCount: 2,
  childCount: 1,
  source: 'FRONT_DESK',
  roomTotal: 2_000_000,
  depositAmount: 200_000,
}

const failure = (message: string) => ({
  isAxiosError: true,
  response: { status: 409, data: { message } },
})

function fillGuest() {
  fireEvent.change(screen.getByLabelText(/Họ tên/), { target: { value: 'Khách vãng lai' } })
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'k@example.test' } })
  fireEvent.change(screen.getByLabelText(/Số điện thoại/), { target: { value: '0911111111' } })
}

function chooseDeposit(method: 'CASH' | 'CARD' | 'VNPAY' = 'CASH') {
  fireEvent.change(screen.getByLabelText(/Hình thức thu cọc/), { target: { value: method } })
}

async function searchRooms() {
  fireEvent.change(screen.getByLabelText(/Nhận phòng/), { target: { value: '2099-01-10' } })
  fireEvent.change(screen.getByLabelText(/Trả phòng/), { target: { value: '2099-01-12' } })
  fireEvent.change(screen.getByLabelText(/Người lớn/), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText(/Trẻ em/), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tìm phòng trống' }))
  return screen.findByRole('checkbox', { name: /Deluxe.*Phòng 1/ })
}

describe('WalkInBookingPage', () => {
  beforeEach(() => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/availability') return { data: availableRooms }
      throw new Error(`unexpected GET ${url}`)
    })
  })

  it('blocks roles other than receptionist/manager', () => {
    renderPage({ ...receptionist, role: 'CUSTOMER' })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('searches rooms, creates a confirmed booking, takes the deposit and shows both', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/bookings/walk-in') return { data: created }
      if (url === '/bookings/b1/payments/deposit') return { data: {} }
      throw new Error(`unexpected POST ${url}`)
    })
    renderPage()

    fireEvent.click(await searchRooms())
    expect(api.get).toHaveBeenCalledWith('/availability', {
      params: { checkIn: '2099-01-10', checkOut: '2099-01-12', guests: 3 },
    })
    fillGuest()
    chooseDeposit('CASH')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo booking' }))

    expect(await screen.findByText('BKWALK1')).toBeInTheDocument()
    expect(screen.getByText('Đã xác nhận')).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith('/bookings/walk-in', {
      rooms: ['r1'],
      checkIn: '2099-01-10',
      checkOut: '2099-01-12',
      adultCount: 2,
      childCount: 1,
      guestName: 'Khách vãng lai',
      guestEmail: 'k@example.test',
      guestPhone: '0911111111',
    })
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/b1/payments/deposit', {
        method: 'CASH',
        requestId: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/),
      }),
    )
    expect(await screen.findByText(/Đã thu cọc 200\.000/)).toBeInTheDocument()
    expect(screen.getByText(/tiền mặt/)).toBeInTheDocument()
  })

  it('needs a deposit method before creating', async () => {
    const post = vi.spyOn(api, 'post')
    renderPage()
    fireEvent.click(await searchRooms())
    fillGuest()
    const create = screen.getByRole('button', { name: 'Tạo booking' })

    expect(create).toBeDisabled()
    chooseDeposit('CARD')
    expect(create).toBeEnabled()
    expect(post).not.toHaveBeenCalled()
  })

  it('records a card deposit', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => ({
      data: url === '/bookings/walk-in' ? created : {},
    }))
    renderPage()
    fireEvent.click(await searchRooms())
    fillGuest()
    chooseDeposit('CARD')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo booking' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/b1/payments/deposit', {
        method: 'CARD',
        requestId: expect.any(String),
      }),
    )
    expect(await screen.findByText(/Đã thu cọc 200\.000/)).toBeInTheDocument()
    expect(screen.getByText(/thẻ/)).toBeInTheDocument()
  })

  it('opens the VNPay page for the deposit and links to the booking', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/bookings/walk-in') return { data: created }
      if (url === '/payments/deposit')
        return {
          data: {
            transactionRef: 'TXN-DEP',
            paymentUrl: 'https://vnpay.test/pay',
            amount: 200_000,
          },
        }
      throw new Error(`unexpected POST ${url}`)
    })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderPage()
    fireEvent.click(await searchRooms())
    fillGuest()
    chooseDeposit('VNPAY')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo booking' }))

    expect(await screen.findByText('BKWALK1')).toBeInTheDocument()
    await waitFor(() => expect(post).toHaveBeenCalledWith('/payments/deposit', { bookingId: 'b1' }))
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith('https://vnpay.test/pay', '_blank', 'noopener'),
    )
    expect(await screen.findByText(/Đã mở trang VNPay/)).toBeInTheDocument()
    expect(screen.queryByText(/Đã thu cọc/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem booking' })).toHaveAttribute(
      'href',
      '/reception/bookings/BKWALK1',
    )
    // Không ghi khoản cọc tiền mặt/thẻ cho lần thu qua VNPay.
    expect(post).not.toHaveBeenCalledWith('/bookings/b1/payments/deposit', expect.anything())
  })

  it('lets staff open the VNPay page again, and shows the error when it cannot be opened', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValueOnce({ data: created })
      .mockRejectedValueOnce(failure('Cổng lỗi'))
      .mockResolvedValue({
        data: {
          transactionRef: 'TXN-DEP2',
          paymentUrl: 'https://vnpay.test/pay2',
          amount: 200_000,
        },
      })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderPage()
    fireEvent.click(await searchRooms())
    fillGuest()
    chooseDeposit('VNPAY')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo booking' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Cổng lỗi/)
    fireEvent.click(screen.getByRole('button', { name: 'Mở lại trang VNPay' }))

    await waitFor(() =>
      expect(open).toHaveBeenCalledWith('https://vnpay.test/pay2', '_blank', 'noopener'),
    )
    expect(post).toHaveBeenCalledTimes(3)
  })

  it('keeps the booking and retries the deposit with the same request id when it fails', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValueOnce({ data: created })
      .mockRejectedValueOnce(failure('Boom'))
      .mockResolvedValue({ data: {} })
    renderPage()
    fireEvent.click(await searchRooms())
    fillGuest()
    chooseDeposit('CASH')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo booking' }))

    expect(await screen.findByText('BKWALK1')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent(/chưa thu được cọc/i)
    fireEvent.click(screen.getByRole('button', { name: 'Thu cọc lại' }))

    expect(await screen.findByText(/Đã thu cọc 200\.000/)).toBeInTheDocument()
    const deposits = post.mock.calls.filter((call) => call[0] === '/bookings/b1/payments/deposit')
    expect(deposits).toHaveLength(2)
    expect(deposits[1]).toEqual(deposits[0])
  })

  it('prefills the guest details from the query string', async () => {
    renderWithAuth(bookingRoutes, {
      path:
        '/reception/booking/new?' +
        new URLSearchParams({
          guestName: 'Ann Nguyễn',
          guestEmail: 'ann@example.test',
          guestPhone: '0900000003',
        }).toString(),
      auth: { me: receptionist, status: 'authenticated' },
    })
    await searchRooms()
    expect(screen.getByLabelText(/Họ tên/)).toHaveValue('Ann Nguyễn')
    expect(screen.getByLabelText(/Email/)).toHaveValue('ann@example.test')
    expect(screen.getByLabelText(/Số điện thoại/)).toHaveValue('0900000003')
  })

  it('needs at least one room before creating', async () => {
    const post = vi.spyOn(api, 'post')
    renderPage()
    await searchRooms()
    expect(screen.getByRole('button', { name: 'Tạo booking' })).toBeDisabled()
    expect(post).not.toHaveBeenCalled()
  })

  it('shows the server error when rooms were just taken', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'One or more rooms were just taken' } },
    })
    renderPage()
    fireEvent.click(await searchRooms())
    fireEvent.change(screen.getByLabelText(/Họ tên/), { target: { value: 'A' } })
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@example.test' } })
    fireEvent.change(screen.getByLabelText(/Số điện thoại/), { target: { value: '0911111111' } })
    chooseDeposit()
    fireEvent.click(screen.getByRole('button', { name: 'Tạo booking' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('shows a Vietnamese error on the phone field and does not submit when the phone is invalid', async () => {
    const post = vi.spyOn(api, 'post')
    renderPage()
    fireEvent.click(await searchRooms())
    fireEvent.change(screen.getByLabelText(/Họ tên/), { target: { value: 'Khách vãng lai' } })
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'k@example.test' } })
    fireEvent.change(screen.getByLabelText(/Số điện thoại/), { target: { value: 'abc' } })
    chooseDeposit('CASH')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo booking' }))

    expect(await screen.findByText(/Số điện thoại không hợp lệ/)).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })
})
