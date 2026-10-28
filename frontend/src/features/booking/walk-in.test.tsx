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

  it('searches rooms, creates a confirmed booking and shows its code', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: {
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
      },
    })
    renderPage()

    fireEvent.click(await searchRooms())
    expect(api.get).toHaveBeenCalledWith('/availability', {
      params: { checkIn: '2099-01-10', checkOut: '2099-01-12', guests: 3 },
    })
    fireEvent.change(screen.getByLabelText(/Họ tên/), { target: { value: 'Khách vãng lai' } })
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'k@example.test' } })
    fireEvent.change(screen.getByLabelText(/Số điện thoại/), { target: { value: '0911111111' } })
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
    fireEvent.click(screen.getByRole('button', { name: 'Tạo booking' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
