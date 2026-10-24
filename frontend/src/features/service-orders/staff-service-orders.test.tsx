import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { serviceOrderRoutes } from './routes'
import { reviewStaffOrder, type StaffServiceOrder } from './staff-api'
import { staffOrderKeys } from './staff-hooks'
import { billingLabel } from './staff-api'

vi.mock('@/lib/api-client', () => ({ api: { get: vi.fn(), patch: vi.fn() } }))
const receptionist = { ...ME, role: 'RECEPTIONIST' }
const receipt: StaffServiceOrder = {
  id: 'order-1',
  bookingId: 'booking-1',
  serviceId: 'service-1',
  service: { name: 'Giặt ủi', unit: 'kg' },
  quantity: 2,
  unitPriceVND: 26000,
  amount: 52000,
  requestedTime: '2026-10-24T10:00:00Z',
  createdAt: '2026-10-24T09:00:00Z',
  reviewStatus: 'PENDING_REVIEW',
  executionStatus: 'NOT_STARTED',
  customer: { id: 'customer-1', fullName: 'Nguyễn An' },
  booking: {
    code: 'BK001',
    status: 'CHECKED_IN',
    checkIn: '2026-10-20T10:00:00Z',
    checkOut: '2026-10-30T10:00:00Z',
  },
  feeRequired: true,
  billingStatus: 'NOT_REQUIRED',
}
let current: StaffServiceOrder
function page(path = '/staff/service-orders/order-1', role: string | null = 'RECEPTIONIST') {
  return renderWithAuth(
    [...serviceOrderRoutes, { path: '/login', element: <p>Đăng nhập khách</p> }],
    {
      path,
      auth: {
        me: role ? { ...receptionist, role, permissions: ['service-order:review'] } : null,
        status: role ? 'authenticated' : 'anonymous',
      },
    },
  )
}
function httpError(status: number) {
  return { isAxiosError: true, response: { status } }
}
async function prepare(decision = 'ACCEPT', reason = '') {
  await screen.findByRole('heading', { name: 'Duyệt yêu cầu' })
  fireEvent.change(screen.getByLabelText('Quyết định'), { target: { value: decision } })
  fireEvent.change(screen.getByLabelText(/Lý do \(bắt buộc/), { target: { value: reason } })
  fireEvent.click(screen.getByRole('button', { name: 'Xem lại quyết định' }))
}
beforeEach(() => {
  vi.resetAllMocks()
  current = { ...receipt }
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data:
      url === '/service-orders/requests'
        ? { items: [current], page: 1, limit: 20, total: 41 }
        : current,
  }))
  vi.mocked(api.patch).mockImplementation(async () => {
    current = {
      ...current,
      reviewStatus: 'ACCEPTED',
      billingStatus: 'BILLED',
      invoiceId: 'invoice-1',
      billedAt: '2026-10-24T11:00:00Z',
    }
    return { data: current }
  })
})

describe('Receptionist service-order access', () => {
  it.each([
    'MANAGER',
    'CUSTOMER',
    'SERVICE_STAFF',
    'OPERATIONS_STAFF',
    'CUSTOM_RECEPTIONIST',
    null,
  ])('denies %s on list and detail despite permissions', async (role) => {
    const list = page('/staff/service-orders', role)
    expect(
      await screen.findByText(role ? 'Không có quyền truy cập' : 'Đăng nhập khách'),
    ).toBeInTheDocument()
    list.unmount()
    page('/staff/service-orders/order-1', role)
    expect(
      await screen.findByText(role ? 'Không có quyền truy cập' : 'Đăng nhập khách'),
    ).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
    expect(api.patch).not.toHaveBeenCalled()
  })
  it.each(['RECEPTIONIST', 'MANAGER', 'CUSTOMER', 'CUSTOM_RECEPTIONIST'])(
    'only shows staff menu to exact Receptionist: %s',
    (role) => {
      renderWithAuth([{ path: '/', element: <UserMenu /> }], {
        auth: { me: { ...ME, role }, status: 'authenticated' },
      })
      const link = screen
        .queryAllByRole('link')
        .find((item) => item.getAttribute('href') === '/staff/service-orders')
      expect(Boolean(link)).toBe(role === 'RECEPTIONIST')
    },
  )
  it('isolates query keys by user, role, filters and detail', () => {
    expect(staffOrderKeys.scope('one', 'RECEPTIONIST')).not.toEqual(
      staffOrderKeys.scope('two', 'RECEPTIONIST'),
    )
    expect(staffOrderKeys.scope('one', 'MANAGER')).not.toEqual(
      staffOrderKeys.scope('one', 'RECEPTIONIST'),
    )
    expect(staffOrderKeys.list('one', 'RECEPTIONIST', { page: 1, limit: 20 })).not.toEqual(
      staffOrderKeys.list('one', 'RECEPTIONIST', { page: 2, limit: 20 }),
    )
    expect(staffOrderKeys.detail('one', 'RECEPTIONIST', '1')).not.toEqual(
      staffOrderKeys.detail('one', 'RECEPTIONIST', '2'),
    )
  })
})
describe('staff list and detail', () => {
  it('defaults pending and filters, searches and paginates with the staff endpoint', async () => {
    page('/staff/service-orders')
    await screen.findByRole('link', { name: 'Giặt ủi' })
    expect(api.get).toHaveBeenCalledWith('/service-orders/requests', {
      params: { page: 1, limit: 20, reviewStatus: 'PENDING_REVIEW' },
    })
    expect(screen.getByText(/Nguyễn An/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/service-orders/requests', {
        params: { page: 2, limit: 20, reviewStatus: 'PENDING_REVIEW' },
      }),
    )
    fireEvent.change(screen.getByLabelText('Trạng thái duyệt'), { target: { value: 'ACCEPTING' } })
    fireEvent.change(screen.getByLabelText('Trạng thái thực hiện'), {
      target: { value: 'NOT_STARTED' },
    })
    fireEvent.change(screen.getByLabelText('Từ khóa dịch vụ'), { target: { value: '  giặt.*  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/service-orders/requests', {
        params: {
          page: 1,
          limit: 20,
          reviewStatus: 'ACCEPTING',
          executionStatus: 'NOT_STARTED',
          keyword: 'giặt.*',
        },
      }),
    )
    fireEvent.change(screen.getByLabelText('Số yêu cầu mỗi trang'), { target: { value: '10' } })
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/service-orders/requests', {
        params: expect.objectContaining({ page: 1, limit: 10 }),
      }),
    )
  })
  it('shows loading, then empty list', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(api.get).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    page('/staff/service-orders')
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải')
    await act(async () => finish({ data: { items: [], page: 1, limit: 20, total: 0 } }))
    expect(await screen.findByText('Không có yêu cầu dịch vụ phù hợp.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
  })
  it.each(['/staff/service-orders', '/staff/service-orders/order-1'])(
    'loads error and retries %s',
    async (path) => {
      vi.mocked(api.get).mockRejectedValueOnce(httpError(403))
      page(path)
      expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền')
      fireEvent.click(
        within(screen.getByRole('alert')).getByRole('button', { name: 'Tải lại trạng thái' }),
      )
      await screen.findByText(/Nguyễn An/)
    },
  )
  it('renders snapshot, booking, nullable customer and missing booking safely', async () => {
    current = { ...current, customer: { id: 'customer-1', fullName: null }, booking: null }
    page()
    await screen.findByText(/Không có tên/)
    expect(screen.getByText('Không còn thông tin đặt phòng.')).toBeInTheDocument()
    expect(screen.getByText('2 kg')).toBeInTheDocument()
    expect(screen.getByText(/26\.000/)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/service-orders/requests/order-1')
    expect(screen.queryByRole('link', { name: /hóa đơn/ })).not.toBeInTheDocument()
  })
})
describe('review safety', () => {
  it('confirms acceptance, sends only trimmed intent, then refreshes authoritative detail and cached lists', async () => {
    const view = page('/staff/service-orders')
    fireEvent.click(await screen.findByRole('link', { name: 'Giặt ủi' }))
    await prepare('ACCEPT', '  Có thể xử lý  ')
    expect(api.patch).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('52.000')
    expect(screen.getByRole('dialog')).toHaveTextContent('Chưa phân công công việc')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    await screen.findByText('Kết quả duyệt đã hoàn tất, chỉ xem.')
    expect(api.patch).toHaveBeenCalledExactlyOnceWith('/service-orders/order-1/review', {
      decision: 'ACCEPT',
      reason: 'Có thể xử lý',
    })
    expect(screen.getByText(/Tổng phí đã thêm/)).toHaveTextContent(
      'Không xác nhận khách đã thanh toán',
    )
    expect(
      vi.mocked(api.get).mock.calls.filter(([url]) => url === '/service-orders/requests/order-1')
        .length,
    ).toBeGreaterThan(1)
    await act(async () => {
      await view.router.navigate('/staff/service-orders')
    })
    await screen.findByText(/Đã ghi vào hóa đơn/)
    expect(
      vi.mocked(api.get).mock.calls.filter(([url]) => url === '/service-orders/requests').length,
    ).toBeGreaterThan(1)
  })
  it('requires rejection reason and allows cancel before a real review', async () => {
    page()
    await prepare('REJECT', '   ')
    expect(screen.getByRole('alert')).toHaveTextContent('bắt buộc')
    expect(api.patch).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(/Lý do \(bắt buộc/), {
      target: { value: '  Hết khả năng phục vụ  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại quyết định' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('không ghi phí và không tạo công việc')
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(api.patch).not.toHaveBeenCalled()
    vi.mocked(api.patch).mockImplementationOnce(async () => {
      current = { ...current, reviewStatus: 'REJECTED' }
      return { data: current }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại quyết định' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    await screen.findByText('Kết quả duyệt đã hoàn tất, chỉ xem.')
    expect(api.patch).toHaveBeenCalledWith('/service-orders/order-1/review', {
      decision: 'REJECT',
      reason: 'Hết khả năng phục vụ',
    })
    expect(screen.getByText('Không ghi phí · đã từ chối')).toBeInTheDocument()
    expect(screen.queryByText(/Tổng phí đã thêm/)).not.toBeInTheDocument()
  })
  it('shows free acceptance without billing claims', async () => {
    current = { ...current, amount: 0, unitPriceVND: 0, feeRequired: false }
    vi.mocked(api.patch).mockImplementationOnce(async () => {
      current = { ...current, reviewStatus: 'ACCEPTED' }
      return { data: current }
    })
    page()
    await prepare()
    expect(screen.getByRole('dialog')).toHaveTextContent('không tính phí, không ghi phí')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    await screen.findByText('Kết quả duyệt đã hoàn tất, chỉ xem.')
    expect(screen.getByText('Không tính phí')).toBeInTheDocument()
    expect(screen.queryByText(/Tổng phí đã thêm/)).not.toBeInTheDocument()
  })
  it('guards double confirmation and disables review while pending', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(api.patch).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    page()
    await prepare()
    const confirm = screen.getByRole('button', { name: 'Xác nhận gửi' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled()
    expect(screen.getByLabelText('Quyết định')).toBeDisabled()
    await act(async () => finish({ data: current }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Thử lại cùng nội dung' })).toBeEnabled(),
    )
  })
  it('recovers 503 with persisted ACCEPT reason and never treats pending billing as accepted', async () => {
    vi.mocked(api.patch).mockImplementationOnce(async () => {
      current = {
        ...current,
        reviewStatus: 'ACCEPTING',
        billingStatus: 'PENDING',
        review: {
          decision: 'ACCEPT',
          reason: 'Đã kiểm tra',
          reviewedBy: 'u1',
          reviewedAt: receipt.createdAt,
        },
      }
      throw httpError(503)
    })
    page()
    await prepare('ACCEPT', 'Đã kiểm tra')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    await screen.findByText('Chờ ghi phí vào hóa đơn')
    expect(screen.getByRole('alert')).toHaveTextContent('chưa xác nhận chấp nhận')
    expect(screen.queryByText('Kết quả duyệt đã hoàn tất, chỉ xem.')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Lý do \(bắt buộc/)).toBeDisabled()
    expect(screen.getByLabelText(/Lý do \(bắt buộc/)).toHaveValue('Đã kiểm tra')
    const retry = screen.getByRole('button', { name: 'Thử lại cùng nội dung' })
    await waitFor(() => expect(retry).toBeEnabled())
    fireEvent.click(retry)
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    await screen.findByText('Kết quả duyệt đã hoàn tất, chỉ xem.')
    expect(vi.mocked(api.patch).mock.calls.map((call) => call[1])).toEqual([
      { decision: 'ACCEPT', reason: 'Đã kiểm tra' },
      { decision: 'ACCEPT', reason: 'Đã kiểm tra' },
    ])
  })
  it('reloads durable ACCEPTING intent and locks it without a prior local mutation', async () => {
    current = {
      ...current,
      reviewStatus: 'ACCEPTING',
      billingStatus: 'PENDING',
      review: {
        decision: 'ACCEPT',
        reason: 'Lý do đã lưu',
        reviewedBy: 'u2',
        reviewedAt: receipt.createdAt,
      },
    }
    page()
    await screen.findByRole('button', { name: 'Thử lại cùng nội dung' })
    expect(screen.getByLabelText('Quyết định')).toBeDisabled()
    expect(screen.getByLabelText(/Lý do \(bắt buộc/)).toHaveValue('Lý do đã lưu')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại cùng nội dung' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    await screen.findByText('Kết quả duyệt đã hoàn tất, chỉ xem.')
    expect(api.patch).toHaveBeenCalledWith('/service-orders/order-1/review', {
      decision: 'ACCEPT',
      reason: 'Lý do đã lưu',
    })
  })
  it('refreshes on 409 and retains immutable sent payload when still pending', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(httpError(409))
    page()
    await prepare('REJECT', 'Không phục vụ')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    await screen.findByRole('alert')
    const retry = screen.getByRole('button', { name: 'Thử lại cùng nội dung' })
    await waitFor(() => expect(retry).toBeEnabled())
    expect(screen.getByLabelText(/Lý do \(bắt buộc/)).toBeDisabled()
    expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(1)
    fireEvent.click(retry)
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    await screen.findByText('Kết quả duyệt đã hoàn tất, chỉ xem.')
    expect(vi.mocked(api.patch).mock.calls[1][1]).toEqual(vi.mocked(api.patch).mock.calls[0][1])
  })
  it('refreshes a final result after lost response and offers no further action', async () => {
    vi.mocked(api.patch).mockImplementationOnce(async () => {
      current = { ...current, reviewStatus: 'ACCEPTED', billingStatus: 'BILLED' }
      throw httpError(503)
    })
    page()
    await prepare()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    await screen.findByText('Kết quả duyệt đã hoàn tất, chỉ xem.')
    expect(screen.queryByRole('button', { name: 'Thử lại cùng nội dung' })).not.toBeInTheDocument()
  })
  it('validates DTO length, trims reason and excludes injected fields', async () => {
    await expect(reviewStaffOrder('one', { decision: 'REJECT', reason: '  ' })).rejects.toThrow()
    await expect(
      reviewStaffOrder('one', { decision: 'ACCEPT', reason: 'x'.repeat(2001) }),
    ).rejects.toThrow()
    expect(api.patch).not.toHaveBeenCalled()
    await reviewStaffOrder('one', {
      decision: 'REJECT',
      reason: '  Không  ',
      amount: 1,
      customer: 'foreign',
    } as never)
    expect(api.patch).toHaveBeenCalledWith('/service-orders/one/review', {
      decision: 'REJECT',
      reason: 'Không',
    })
  })
  it('does not label an unreviewed billable request as free', () => {
    expect(billingLabel(receipt)).toBe('Chưa ghi phí')
  })
})
