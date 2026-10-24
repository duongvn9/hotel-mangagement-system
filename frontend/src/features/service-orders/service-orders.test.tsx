import { configure, fireEvent, screen, waitFor } from '@testing-library/react'

configure({ asyncUtilTimeout: 5000 })
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { createOrder, estimateAmount, normalizeOrderQuery, type ServiceOrder } from './api'
import { orderKeys } from './hooks'
import { serviceOrderRoutes } from './routes'

vi.mock('@/lib/api-client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const bookingId = 'a'.repeat(24)
const serviceId = 'b'.repeat(24)
const customer = { ...ME, id: 'customer-1', role: 'CUSTOMER' }
const service = {
  id: serviceId,
  name: 'Giặt ủi',
  description: 'Giặt quần áo',
  unit: 'kg',
  billable: true,
  unitPriceVND: 25000,
}
const context = {
  id: bookingId,
  code: 'BK001',
  checkIn: '2026-10-20T10:00:00Z',
  checkOut: '2026-10-30T10:00:00Z',
}
const receipt: ServiceOrder = {
  id: 'order-1',
  bookingId,
  serviceId,
  service: { name: 'Giặt ủi', unit: 'kg' },
  quantity: 2,
  unitPriceVND: 26000,
  amount: 52000,
  requestedTime: '2026-10-24T10:00:00Z',
  createdAt: '2026-10-24T09:00:00Z',
  reviewStatus: 'PENDING_REVIEW',
  executionStatus: 'NOT_STARTED',
}
function renderPage(path = '/customer/service-orders/new', me: typeof customer | null = customer) {
  return renderWithAuth(
    [...serviceOrderRoutes, { path: '/login', element: <p>Đăng nhập khách</p> }],
    { path, auth: { me, status: me ? 'authenticated' : 'anonymous' } },
  )
}
function choices(bookings = [context], services = [service]) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/service-orders/order-contexts') return { data: { items: bookings } }
    if (url === '/service-orders/catalog') return { data: { items: services } }
    if (url === '/service-orders/me')
      return { data: { items: [receipt], total: 1, page: 1, limit: 20 } }
    return { data: receipt }
  })
}
async function fill() {
  await screen.findByRole('option', { name: /Giặt ủi/ })
  fireEvent.change(screen.getByLabelText(/Đặt phòng đã nhận phòng/), {
    target: { value: bookingId },
  })
  fireEvent.change(screen.getByLabelText(/^Dịch vụ/), { target: { value: serviceId } })
  fireEvent.change(screen.getByLabelText(/Số lượng/), { target: { value: '2' } })
}
function submit() {
  fireEvent.submit(screen.getByLabelText(/Số lượng/).closest('form')!)
}
beforeEach(() => {
  vi.resetAllMocks()
  choices()
  vi.mocked(api.post).mockResolvedValue({ data: receipt })
})

describe('Customer service-order access', () => {
  it.each([
    '/customer/service-orders',
    '/customer/service-orders/new',
    '/customer/service-orders/order-1',
  ])('redirects guests from %s', async (path) => {
    renderPage(path, null)
    expect(await screen.findByText('Đăng nhập khách')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })
  it.each(['MANAGER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'denies %s even with permissions',
    async (role) => {
      renderPage('/customer/service-orders/new', {
        ...customer,
        role,
        permissions: ['service:read', 'service-order:create'],
      })
      expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument()
      expect(api.get).not.toHaveBeenCalled()
    },
  )
})
describe('service-order form', () => {
  it('loads only Customer choice endpoints, estimates locally, submits a whitelist, and shows server receipt', async () => {
    renderPage()
    await fill()
    expect(screen.getByText(/Thành tiền ước tính/)).toHaveTextContent('50.000')
    fireEvent.change(screen.getByLabelText(/Ghi chú/), { target: { value: '  Nhẹ tay  ' } })
    fireEvent.change(screen.getByLabelText(/Thời gian yêu cầu/), {
      target: { value: '2020-01-01T10:30' },
    })
    submit()
    await screen.findByRole('heading', { name: 'Đã gửi yêu cầu dịch vụ' })
    const body = vi.mocked(api.post).mock.calls[0][1]
    expect(body).toEqual({
      bookingId,
      serviceId,
      quantity: 2,
      notes: 'Nhẹ tay',
      requestedTime: new Date('2020-01-01T10:30').toISOString(),
      requestId: expect.any(String),
    })
    expect(screen.getByText(/52\.000/)).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith('/services', expect.anything())
  })
  it('omits optional time and notes; keeps UUID on a failed retry and allows intentional repeat with new UUID', async () => {
    vi.mocked(api.post)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ data: receipt })
    renderPage()
    await fill()
    submit()
    await screen.findByRole('alert')
    const first = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect(first).not.toHaveProperty('requestedTime')
    expect(first).not.toHaveProperty('notes')
    submit()
    await screen.findByRole('heading', { name: 'Đã gửi yêu cầu dịch vụ' })
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(first)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu mới' }))
    await screen.findByRole('button', { name: 'Gửi yêu cầu' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gửi yêu cầu' })).toBeEnabled())
    submit()
    await screen.findByRole('heading', { name: 'Đã gửi yêu cầu dịch vụ' })
    expect((vi.mocked(api.post).mock.calls[2][1] as Record<string, unknown>).requestId).not.toBe(
      first.requestId,
    )
  })
  it('changes UUID after editing the payload', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('network'))
    renderPage()
    await fill()
    submit()
    await screen.findByRole('alert')
    fireEvent.change(screen.getByLabelText(/Số lượng/), { target: { value: '3' } })
    submit()
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
    expect((vi.mocked(api.post).mock.calls[1][1] as Record<string, unknown>).requestId).not.toBe(
      (vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>).requestId,
    )
  })
  it('blocks duplicate submissions while pending', async () => {
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}))
    renderPage()
    await fill()
    submit()
    submit()
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Đang gửi…' })).toBeDisabled()
  })
  it.each(['0', '-1', '1.5', '9007199254740992', '9007199254740991'])(
    'rejects invalid quantity or amount overflow %s',
    async (value) => {
      renderPage()
      await fill()
      fireEvent.change(screen.getByLabelText(/Số lượng/), { target: { value } })
      submit()
      expect(await screen.findByRole('alert')).toHaveTextContent('Số lượng phải là số nguyên dương')
      expect(api.post).not.toHaveBeenCalled()
    },
  )
  it('bounds notes by the backend DTO', async () => {
    renderPage()
    await fill()
    fireEvent.change(screen.getByLabelText(/Ghi chú/), { target: { value: 'x'.repeat(2001) } })
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Ghi chú tối đa 2000')
    expect(api.post).not.toHaveBeenCalled()
  })
  it.each(['contexts', 'catalog'])('disables submission for empty %s', async (kind) => {
    choices(kind === 'contexts' ? [] : [context], kind === 'catalog' ? [] : [service])
    renderPage()
    await screen.findByText(
      kind === 'contexts' ? /Bạn không có kỳ lưu trú/ : /Hiện không có dịch vụ/,
    )
    expect(screen.getByRole('button', { name: 'Gửi yêu cầu' })).toBeDisabled()
    submit()
    expect(api.post).not.toHaveBeenCalled()
  })
  it('removes an unavailable catalog choice after refresh', async () => {
    renderPage()
    await fill()
    choices([context], [])
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại lựa chọn' }))
    await screen.findByText(/Hiện không có dịch vụ/)
    expect(screen.queryByRole('option', { name: /Giặt ủi/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gửi yêu cầu' })).toBeDisabled()
  })
  it('validates query prefill against real choices without selecting another booking', async () => {
    renderPage(`/customer/service-orders/new?bookingId=foreign&serviceId=${serviceId}`)
    await screen.findByText(/trong liên kết không có/)
    expect(screen.getByLabelText(/Đặt phòng đã nhận phòng/)).toHaveValue('')
    expect(screen.getByLabelText(/^Dịch vụ/)).toHaveValue(serviceId)
    expect(screen.getByRole('button', { name: 'Gửi yêu cầu' })).toBeDisabled()
  })
  it('accepts valid query choices and free services without isAvailable', async () => {
    choices([context], [{ ...service, billable: false, unitPriceVND: 1000 }])
    renderPage(`/customer/service-orders/new?bookingId=${bookingId}&serviceId=${serviceId}`)
    await screen.findByText(/Không tính phí/)
    expect(screen.getByText(/Thành tiền ước tính/)).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: 'Gửi yêu cầu' })).toBeEnabled()
  })
})
describe('list and detail', () => {
  it('uses my list, literal keyword and exact enum filters', async () => {
    renderPage('/customer/service-orders')
    await screen.findByRole('link', { name: 'Giặt ủi' })
    fireEvent.change(screen.getByLabelText('Từ khóa'), { target: { value: '.*[abc]' } })
    fireEvent.change(screen.getByLabelText('Trạng thái duyệt'), {
      target: { value: 'PENDING_REVIEW' },
    })
    fireEvent.change(screen.getByLabelText('Trạng thái thực hiện'), {
      target: { value: 'NOT_STARTED' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/service-orders/me', {
        params: {
          page: 1,
          limit: 20,
          keyword: '.*[abc]',
          reviewStatus: 'PENDING_REVIEW',
          executionStatus: 'NOT_STARTED',
        },
      }),
    )
    expect(await screen.findByText('Chờ duyệt · Chưa bắt đầu')).toBeInTheDocument()
  })
  it('renders empty list', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 20 } })
    renderPage('/customer/service-orders')
    expect(await screen.findByText('Không có yêu cầu dịch vụ phù hợp.')).toBeInTheDocument()
  })
  it('renders loading and then the owned detail without staff actions', async () => {
    let resolve!: (value: unknown) => void
    vi.mocked(api.get).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }) as ReturnType<typeof api.get>,
    )
    renderPage('/customer/service-orders/order-1')
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải')
    resolve({ data: receipt })
    await screen.findByText('Thành tiền ghi nhận từ máy chủ')
    expect(api.get).toHaveBeenCalledWith('/service-orders/order-1')
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Duyệt|Phân công|Hoàn thành/ }),
    ).not.toBeInTheDocument()
  })
  it.each([403, 404, 409, 500])('shows %s detail errors without leaking data', async (status) => {
    vi.mocked(api.get).mockRejectedValue({ isAxiosError: true, response: { status } })
    renderPage('/customer/service-orders/foreign')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      status === 403
        ? 'không có quyền'
        : status === 404
          ? 'Không tìm thấy'
          : status === 409
            ? 'không còn ở trạng thái'
            : 'Không thể kết nối',
    )
    expect(screen.queryByText('Thành tiền ghi nhận từ máy chủ')).not.toBeInTheDocument()
  })
  it('shows choice loading and recoverable errors', async () => {
    vi.mocked(api.get).mockRejectedValue({ isAxiosError: true, response: { status: 403 } })
    renderPage()
    expect(screen.getByText('Đang tải đặt phòng và dịch vụ…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(screen.getByRole('button', { name: 'Gửi yêu cầu' })).toBeDisabled()
    choices()
    fireEvent.click(screen.getAllByRole('button', { name: 'Thử lại' })[0])
    await screen.findByRole('option', { name: /Giặt ủi/ })
  })
  it('scopes every key by user and role', () => {
    expect(orderKeys.scope('a', 'CUSTOMER')).not.toEqual(orderKeys.scope('b', 'CUSTOMER'))
    expect(orderKeys.detail('a', 'CUSTOMER', '1')).not.toEqual(
      orderKeys.detail('b', 'CUSTOMER', '1'),
    )
    expect(orderKeys.list('a', 'CUSTOMER', { page: 1, limit: 20 })).not.toEqual(
      orderKeys.list('b', 'CUSTOMER', { page: 1, limit: 20 }),
    )
  })
})
it('whitelists even runtime-spoofed extra payload fields', async () => {
  await createOrder({
    bookingId,
    serviceId,
    quantity: 1,
    price: 1,
    amount: 1,
    customerId: 'foreign',
    reviewStatus: 'ACCEPTED',
  } as Parameters<typeof createOrder>[0])
  expect(api.post).toHaveBeenCalledWith('/service-orders', { bookingId, serviceId, quantity: 1 })
})
it('checks safe estimates and normalizes pagination without treating keywords as regex', () => {
  expect(estimateAmount(service, Number.MAX_SAFE_INTEGER)).toBeNull()
  expect(estimateAmount({ ...service, billable: false }, Number.MAX_SAFE_INTEGER)).toBe(0)
  expect(normalizeOrderQuery({ page: 0, limit: 500, keyword: '.*' })).toEqual({
    page: 1,
    limit: 100,
    keyword: '.*',
  })
})
