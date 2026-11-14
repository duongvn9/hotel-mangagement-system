import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingListPage } from './api'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const page = (overrides: Partial<BookingListPage> = {}): BookingListPage => ({
  items: [
    {
      id: 'b1',
      code: 'BKLIST1',
      status: 'CONFIRMED',
      guestName: 'Nguyễn Văn A',
      guestEmail: 'a@example.test',
      guestPhone: '0900000001',
      rooms: [{ id: 'r1', roomNumber: '101', roomTypeName: 'Deluxe' }],
      checkIn: '2099-01-09T17:00:00.000Z',
      checkOut: '2099-01-11T17:00:00.000Z',
      adultCount: 2,
      childCount: 1,
      source: 'FRONT_DESK',
      roomTotal: 2_000_000,
      createdAt: '2099-01-01T00:00:00.000Z',
      walkIn: true,
    },
    {
      id: 'b2',
      code: 'BKLIST2',
      status: 'PENDING_DEPOSIT',
      guestName: 'Trần Thị B',
      guestEmail: 'b@example.test',
      guestPhone: '0900000002',
      rooms: [{ id: 'r2', roomNumber: '102', roomTypeName: 'Suite' }],
      checkIn: '2099-02-09T17:00:00.000Z',
      checkOut: '2099-02-11T17:00:00.000Z',
      adultCount: 1,
      childCount: 0,
      source: 'ONLINE',
      roomTotal: 3_000_000,
      createdAt: '2099-01-02T00:00:00.000Z',
      walkIn: false,
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  ...overrides,
})

function renderPage(role = receptionist) {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/bookings',
    auth: { me: role, status: 'authenticated' },
  })
}

describe('BookingListPage', () => {
  it('blocks roles other than receptionist/manager', () => {
    renderPage({ ...receptionist, role: 'CUSTOMER' })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('lists bookings with status, rooms and the walk-in marker', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: page() })
    renderPage()

    expect(await screen.findByText('BKLIST1')).toBeInTheDocument()
    expect(screen.getByText('BKLIST2')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    const rows = within(screen.getByRole('list'))
    expect(rows.getByText('Đã xác nhận')).toBeInTheDocument()
    expect(rows.getByText('Chờ đặt cọc')).toBeInTheDocument()
    expect(rows.getByText(/101 · Deluxe/)).toBeInTheDocument()
    expect(rows.getAllByText('Tại quầy')).toHaveLength(1)
    expect(rows.getByText('3 khách')).toBeInTheDocument()
    expect(rows.getByText('1 khách')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /BKLIST1/ })).toHaveAttribute(
      'href',
      '/reception/bookings/BKLIST1',
    )
    expect(get).toHaveBeenCalledWith('/bookings', { params: { page: 1, limit: 20 } })
  })

  it('sends the filters to the API and returns to page 1', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: page() })
    renderPage()
    await screen.findByText('BKLIST1')

    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: ' BKLIST2 ' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'CANCELLED' } })
    fireEvent.change(screen.getByLabelText('Nhận phòng từ'), { target: { value: '2099-02-01' } })
    fireEvent.change(screen.getByLabelText('Nhận phòng đến'), { target: { value: '2099-02-28' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lọc' }))

    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/bookings', {
        params: {
          page: 1,
          limit: 20,
          q: 'BKLIST2',
          status: 'CANCELLED',
          checkInFrom: '2099-02-01',
          checkInTo: '2099-02-28',
        },
      }),
    )
  })

  it('starts from the search text in the URL', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: page() })
    renderWithAuth(bookingRoutes, {
      path: '/reception/bookings?q=ann%40example.test',
      auth: { me: receptionist, status: 'authenticated' },
    })
    await screen.findByText('BKLIST1')
    expect(get).toHaveBeenCalledWith('/bookings', {
      params: { page: 1, limit: 20, q: 'ann@example.test' },
    })
    expect(screen.getByLabelText('Tìm kiếm')).toHaveValue('ann@example.test')
  })

  it('pages through results', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: page({ total: 45, limit: 20 }) })
    renderPage()
    await screen.findByText('BKLIST1')
    expect(screen.getByText('Trang 1 / 3 · 45 booking')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/bookings', { params: { page: 2, limit: 20 } }),
    )
  })

  it('shows an empty state and an error state', async () => {
    // Trang này còn gọi /bookings/attention (cảnh báo lễ tân); định tuyến mock theo URL.
    vi.spyOn(api, 'get').mockImplementation(async (url) =>
      url === '/bookings/attention'
        ? { data: { overdueCheckOut: 0, overdueCheckIn: 0, dueCheckOut: 0, dueCheckIn: 0 } }
        : { data: page({ items: [], total: 0 }) },
    )
    const empty = renderPage()
    expect(await screen.findByText('Không có booking nào phù hợp.')).toBeInTheDocument()
    empty.unmount()

    vi.spyOn(api, 'get').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Boom' } },
    })
    renderPage()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('marks bookings needing attention with a badge and sorts them first', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-10T12:00:00Z') })
    vi.spyOn(api, 'get').mockImplementation(async (url) =>
      url === '/bookings/attention'
        ? { data: { overdueCheckOut: 0, overdueCheckIn: 0, dueCheckOut: 0, dueCheckIn: 0 } }
        : {
            data: page({
              items: [
                { ...page().items[1], id: 'bn', code: 'BK-NORMAL', status: 'CONFIRMED' },
                {
                  ...page().items[0],
                  id: 'bo',
                  code: 'BK-OVERDUE',
                  status: 'CHECKED_IN',
                  checkIn: '2026-11-05T05:00:00.000Z',
                  checkOut: '2026-11-08T05:00:00.000Z',
                },
              ],
            }),
          },
    )
    renderPage()
    expect(await screen.findByText('Quá hạn trả phòng')).toBeInTheDocument()
    const codes = screen.getAllByText(/^BK-(OVERDUE|NORMAL)$/).map((el) => el.textContent)
    expect(codes).toEqual(['BK-OVERDUE', 'BK-NORMAL'])
    vi.useRealTimers()
  })

  describe('attention chips', () => {
    const counts = { overdueCheckOut: 0, overdueCheckIn: 4, dueCheckOut: 1, dueCheckIn: 8 }
    function mockApi() {
      return vi
        .spyOn(api, 'get')
        .mockImplementation(async (url) =>
          url === '/bookings/attention' ? { data: counts } : { data: page({ total: 45 }) },
        )
    }
    const bookingCalls = (get: ReturnType<typeof mockApi>) =>
      get.mock.calls.filter(([url]) => url === '/bookings')

    it('filters the list by the chip that is clicked, and unfilters on a second click', async () => {
      const get = mockApi()
      renderPage()
      await screen.findByText('BKLIST1')
      fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
      await waitFor(() =>
        expect(bookingCalls(get).at(-1)?.[1]).toEqual({ params: { page: 2, limit: 20 } }),
      )

      fireEvent.click(await screen.findByRole('button', { name: /Quá hạn nhận phòng\s*4/ }))

      await waitFor(() =>
        expect(bookingCalls(get).at(-1)?.[1]).toEqual({
          params: { page: 1, limit: 20, attention: 'overdueCheckIn' },
        }),
      )
      expect(screen.getByRole('button', { name: /Quá hạn nhận phòng\s*4/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      fireEvent.click(screen.getByRole('button', { name: /Quá hạn nhận phòng\s*4/ }))
      await waitFor(() =>
        expect(bookingCalls(get).at(-1)?.[1]).toEqual({ params: { page: 1, limit: 20 } }),
      )
    })

    it('switches straight from one chip to another', async () => {
      const get = mockApi()
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: /Quá hạn nhận phòng\s*4/ }))
      fireEvent.click(screen.getByRole('button', { name: /Nhận phòng hôm nay\s*8/ }))

      await waitFor(() =>
        expect(bookingCalls(get).at(-1)?.[1]).toEqual({
          params: { page: 1, limit: 20, attention: 'dueCheckIn' },
        }),
      )
      expect(screen.getByRole('button', { name: /Quá hạn nhận phòng\s*4/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    })

    it('keeps the chip while the search form is applied, and clears it with the other filters', async () => {
      const get = mockApi()
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: /Trả phòng hôm nay\s*1/ }))
      fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'an' } })
      // "Lọc" is disabled while the list reloads after the chip click.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Lọc' })).toBeEnabled())
      fireEvent.click(screen.getByRole('button', { name: 'Lọc' }))

      await waitFor(() =>
        expect(bookingCalls(get).at(-1)?.[1]).toEqual({
          params: { page: 1, limit: 20, q: 'an', attention: 'dueCheckOut' },
        }),
      )

      fireEvent.click(screen.getByRole('button', { name: 'Xoá bộ lọc' }))
      await waitFor(() =>
        expect(bookingCalls(get).at(-1)?.[1]).toEqual({ params: { page: 1, limit: 20 } }),
      )
      expect(screen.getByRole('button', { name: /Trả phòng hôm nay\s*1/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    })
  })
})
