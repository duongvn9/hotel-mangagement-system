import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import type { CatalogService, OrderContext, ServiceOrder } from './api'
import { serviceOrderRoutes } from './routes'

configure({ asyncUtilTimeout: 5000 })
vi.mock('@/lib/api-client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

const customer = { ...ME, id: 'customer-1', role: 'CUSTOMER' }
const inHouse: OrderContext = {
  id: 'a'.repeat(24),
  code: 'BK2401',
  status: 'CHECKED_IN',
  roomNumber: '101',
  checkIn: '2026-11-02T10:00:00Z',
  checkOut: '2026-11-04T10:00:00Z',
}
const upcoming: OrderContext = {
  id: 'c'.repeat(24),
  code: 'BK2500',
  status: 'CONFIRMED',
  checkIn: '2026-12-20T10:00:00Z',
  checkOut: '2026-12-22T10:00:00Z',
}
const laundry: CatalogService = {
  id: 'b'.repeat(24),
  name: 'Giặt ủi',
  description: 'Giặt quần áo',
  unit: 'bộ',
  billable: true,
  unitPriceVND: 150000,
}
const breakfast: CatalogService = {
  id: 'd'.repeat(24),
  name: 'Bữa sáng tại phòng',
  description: '',
  unit: 'suất',
  billable: true,
  unitPriceVND: 280000,
}
const welcome: CatalogService = {
  id: 'e'.repeat(24),
  name: 'Nước chào đón',
  description: '',
  unit: 'chai',
  billable: false,
  unitPriceVND: 0,
}
const order = (overrides: Partial<ServiceOrder> = {}): ServiceOrder => ({
  id: 'order-1',
  bookingId: inHouse.id,
  serviceId: laundry.id,
  service: { name: 'Giặt ủi', unit: 'bộ' },
  quantity: 1,
  unitPriceVND: 150000,
  amount: 150000,
  requestedTime: '2026-11-03T10:00:00Z',
  createdAt: '2026-11-03T09:00:00Z',
  reviewStatus: 'PENDING_REVIEW',
  executionStatus: 'NOT_STARTED',
  ...overrides,
})

function mockApi(
  options: {
    contexts?: OrderContext[]
    services?: CatalogService[]
    orders?: ServiceOrder[]
    failContexts?: boolean
  } = {},
) {
  const { contexts = [upcoming, inHouse], services = [breakfast, laundry, welcome] } = options
  const { orders = [order()] } = options
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/service-orders/order-contexts') {
      if (options.failContexts) throw { isAxiosError: true, response: { status: 500, data: {} } }
      return { data: { items: contexts } }
    }
    if (url === '/service-orders/catalog') return { data: { items: services } }
    if (url === '/service-orders/me')
      return { data: { items: orders, total: orders.length, page: 1, limit: 20 } }
    throw new Error(`unexpected GET ${String(url)}`)
  })
}

function renderPage() {
  return renderWithAuth(
    [...serviceOrderRoutes, { path: '/login', element: <p>Đăng nhập khách</p> }],
    { path: '/customer/service-orders', auth: { me: customer, status: 'authenticated' } },
  )
}

const panel = (name: string) =>
  within(screen.getByRole('heading', { name }).closest('section') as HTMLElement)
const card = (name: RegExp) => screen.findByRole('button', { name })

beforeEach(() => {
  vi.resetAllMocks()
  mockApi()
  vi.mocked(api.post).mockResolvedValue({ data: order({ id: 'order-2' }) })
})

describe('RoomServicePage (prototype order-service)', () => {
  it('titles the page and says which room the order is for, preferring the in-house stay', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dịch vụ phòng' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Đặt cho phòng 101 · BK2401')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Đơn mới' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lịch sử đặt dịch vụ' })).toBeInTheDocument()
  })

  it('lets the guest choose which booking to order for', async () => {
    renderPage()
    await screen.findByText('Đặt cho phòng 101 · BK2401')

    fireEvent.click(screen.getByRole('button', { name: 'Chọn booking' }))
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByRole('button', { name: /BK2401/ })).toBeInTheDocument()
    expect(dialog.getByText(/Đã nhận phòng/)).toBeInTheDocument()
    expect(dialog.getByText(/Đã xác nhận/)).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: /BK2500/ }))

    expect(await screen.findByText('Đặt cho booking BK2500')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows the services as cards with unit and price, free ones as free', async () => {
    renderPage()

    const laundryCard = await card(/Giặt ủi/)
    expect(laundryCard).toHaveTextContent('bộ')
    expect(laundryCard).toHaveTextContent('150.000')
    expect(await card(/Bữa sáng tại phòng/)).toHaveTextContent('280.000')
    expect(await card(/Nước chào đón/)).toHaveTextContent('Miễn phí')
  })

  it('asks for quantity and notes only after a service is picked, and totals the price', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Đặt dịch vụ' })).not.toBeInTheDocument()

    fireEvent.click(await card(/Giặt ủi/))

    expect(screen.getByRole('button', { name: 'Đặt dịch vụ' })).toBeEnabled()
    expect(screen.getByLabelText('Số lượng')).toHaveTextContent('1')
    expect(screen.getByText('150.000 ₫', { selector: 'span' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    expect(screen.getByLabelText('Số lượng')).toHaveTextContent('3')
    expect(screen.getByText('450.000 ₫', { selector: 'span' })).toBeInTheDocument()
  })

  it('keeps the quantity between 1 and 10', async () => {
    renderPage()
    fireEvent.click(await card(/Giặt ủi/))

    expect(screen.getByRole('button', { name: 'Giảm số lượng' })).toBeDisabled()
    for (let i = 0; i < 12; i++)
      fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    expect(screen.getByLabelText('Số lượng')).toHaveTextContent('10')
    expect(screen.getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled()
  })

  it('sends the booking, service, quantity and trimmed notes, then clears the form and reloads', async () => {
    renderPage()
    fireEvent.click(await card(/Giặt ủi/))
    fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    fireEvent.change(screen.getByPlaceholderText('Ghi chú cho nhân viên (không bắt buộc)'), {
      target: { value: '  Nhẹ tay  ' },
    })
    const before = vi.mocked(api.get).mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Đặt dịch vụ' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/service-orders', {
        bookingId: inHouse.id,
        serviceId: laundry.id,
        quantity: 2,
        notes: 'Nhẹ tay',
        requestId: expect.any(String),
      }),
    )
    expect(await screen.findByText(/Đã đặt Giặt ủi/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đặt dịch vụ' })).not.toBeInTheDocument()
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(before))
  })

  it('reuses the same request id when a failed order is sent again', async () => {
    vi.mocked(api.post)
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 500, data: {} } })
      .mockResolvedValue({ data: order({ id: 'order-3' }) })
    renderPage()
    fireEvent.click(await card(/Giặt ủi/))

    fireEvent.click(screen.getByRole('button', { name: 'Đặt dịch vụ' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt dịch vụ' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
    const [first, second] = vi
      .mocked(api.post)
      .mock.calls.map((call) => call[1] as { requestId: string })
    expect(second?.requestId).toBe(first?.requestId)
  })

  it('lists the order history with status, links to each order and to the full list', async () => {
    mockApi({
      orders: [
        order(),
        order({
          id: 'order-9',
          service: { name: 'Bữa sáng tại phòng', unit: 'suất' },
          quantity: 2,
          reviewStatus: 'ACCEPTED',
          executionStatus: 'COMPLETED',
        }),
      ],
    })
    renderPage()

    const history = panel('Lịch sử đặt dịch vụ')
    const link = await history.findByRole('link', { name: /Giặt ủi × 1/ })
    expect(link).toHaveAttribute('href', '/customer/service-orders/order-1')
    expect(history.getByText('Chờ duyệt')).toBeInTheDocument()
    expect(history.getByRole('link', { name: /Bữa sáng tại phòng × 2/ })).toBeInTheDocument()
    expect(history.getByText('Đã hoàn thành', { exact: false })).toBeInTheDocument()
    expect(history.getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute(
      'href',
      '/customer/service-orders/history',
    )
  })

  it('says so when there is no order yet', async () => {
    mockApi({ orders: [] })
    renderPage()
    expect(await panel('Lịch sử đặt dịch vụ').findByText('Chưa có đơn nào.')).toBeInTheDocument()
  })

  it('explains when the guest has no stay to order for', async () => {
    mockApi({ contexts: [] })
    renderPage()

    expect(await screen.findByText('Bạn chưa có kỳ lưu trú nào để đặt dịch vụ')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chọn booking' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Giặt ủi/ })).not.toBeInTheDocument()
  })

  it('shows a recoverable error when the choices cannot be loaded', async () => {
    mockApi({ failContexts: true })
    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Thử lại/ })).toBeInTheDocument()
  })
})
