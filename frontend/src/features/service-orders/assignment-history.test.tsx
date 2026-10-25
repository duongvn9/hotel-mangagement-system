import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { serviceOrderRoutes } from './routes'
import type { StaffServiceOrder } from './staff-api'
import { historyKeys } from './history'

vi.mock('@/lib/api-client', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))
const base: StaffServiceOrder = {
  id: 'order-1',
  bookingId: 'booking-1',
  serviceId: 'service-1',
  service: { name: 'Giặt ủi', unit: 'kg' },
  quantity: 2,
  unitPriceVND: 100,
  amount: 200,
  requestedTime: '2026-10-24T10:00:00Z',
  createdAt: '2026-10-24T09:00:00Z',
  reviewStatus: 'ACCEPTED',
  executionStatus: 'NOT_STARTED',
  feeRequired: true,
  billingStatus: 'BILLED',
  customer: { id: 'private-customer', fullName: 'Private name' },
  booking: null,
  task: null,
}
const task = {
  id: 'task-1',
  status: 'COMPLETED',
  assigneeId: 'staff-1',
  assignedAt: '2026-10-24T10:00:00Z',
  completedAt: '2026-10-24T12:00:00Z',
  workResult: '<img src=x onerror=alert(1)> done',
}
const history = { ...base, executionStatus: 'COMPLETED', task }
let current: StaffServiceOrder
function page(path = '/staff/service-orders/order-1', role: string | null = 'RECEPTIONIST') {
  return renderWithAuth([...serviceOrderRoutes, { path: '/login', element: <p>Login</p> }], {
    path,
    auth: {
      me: role ? { ...ME, role, permissions: ['task:execute', 'service-order:review'] } : null,
      status: role ? 'authenticated' : 'anonymous',
    },
  })
}
async function select() {
  await screen.findByRole('option', { name: 'Nhân viên thật' })
  fireEvent.change(screen.getByLabelText('Nhân viên dịch vụ'), { target: { value: 'staff-1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Xem lại phân công' }))
  return screen.findByRole('dialog')
}
beforeEach(() => {
  vi.resetAllMocks()
  current = { ...base }
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: url.toString().endsWith('/assignees')
      ? {
          items: [
            { id: 'staff-1', displayName: 'Nhân viên thật', role: 'SERVICE_STAFF' },
            { id: 'ops', displayName: 'Không hợp lệ', role: 'OPERATIONS_STAFF' },
          ],
        }
      : url === '/service-orders/history/me'
        ? { items: [history], total: 21, page: 1, limit: 20 }
        : url.toString().startsWith('/service-orders/history/')
          ? history
          : current,
  }))
  vi.mocked(api.post).mockImplementation(async () => {
    current = { ...current, executionStatus: 'ASSIGNED', task: { ...task, status: 'ASSIGNED' } }
    return { data: current }
  })
})

describe('assignment', () => {
  it.each(['PENDING_REVIEW', 'ACCEPTING', 'REJECTED'] as const)(
    'cannot assign %s',
    async (reviewStatus) => {
      current = { ...current, reviewStatus }
      page()
      await screen.findByText(/Chỉ phân công sau/)
      expect(screen.queryByLabelText('Nhân viên dịch vụ')).not.toBeInTheDocument()
      expect(api.get).not.toHaveBeenCalledWith('/service-orders/order-1/assignees')
      expect(api.post).not.toHaveBeenCalled()
    },
  )
  it('blocks invoice pending', async () => {
    current = { ...current, billingStatus: 'PENDING' }
    page()
    await screen.findByText(/Chỉ phân công sau/)
    expect(api.post).not.toHaveBeenCalled()
  })
  it('permits fee-free accepted orders', async () => {
    current = { ...current, feeRequired: false, billingStatus: 'NOT_REQUIRED' }
    await act(async () => {
      page()
    })
    await screen.findByRole('option', { name: 'Nhân viên thật' })
    expect(screen.getByRole('button', { name: 'Xem lại phân công' })).toBeDisabled()
    expect(screen.queryByRole('option', { name: 'Không hợp lệ' })).not.toBeInTheDocument()
  })
  it('confirms an exact ISO payload without billing or actor fields and renders linked task only', async () => {
    page()
    await screen.findByRole('option', { name: 'Nhân viên thật' })
    fireEvent.change(screen.getByLabelText(/Hạn hoàn thành/), {
      target: { value: '2026-10-26T14:30' },
    })
    const dialog = await select()
    expect(api.post).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận phân công' }))
    await screen.findByText('Công việc liên kết: task-1')
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/service-orders/order-1/assignment', {
      assigneeId: 'staff-1',
      dueAt: new Date('2026-10-26T14:30').toISOString(),
    })
    expect(screen.queryByText(task.workResult)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /công việc/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Tổng phí đã thêm/)).toBeInTheDocument()
  })
  it('retains the original body after 503 and retries manually without changes', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } })
    page()
    const dialog = await select()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận phân công' }))
    await screen.findByRole('button', { name: 'Thử lại cùng phân công' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Thử lại cùng phân công' })).toBeEnabled(),
    )
    expect(screen.queryByLabelText('Nhân viên dịch vụ')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại cùng phân công' }))
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác nhận phân công' }),
    )
    await screen.findByText('Công việc liên kết: task-1')
    expect(vi.mocked(api.post).mock.calls.map((call) => call[1])).toEqual([
      { assigneeId: 'staff-1' },
      { assigneeId: 'staff-1' },
    ])
  })
  it('refreshes a 409/lost response and does not create again', async () => {
    vi.mocked(api.post).mockImplementationOnce(async () => {
      current = { ...current, executionStatus: 'ASSIGNED', task }
      throw { isAxiosError: true, response: { status: 409 } }
    })
    page()
    const dialog = await select()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận phân công' }))
    await screen.findByText('Công việc liên kết: task-1')
    expect(screen.queryByRole('button', { name: 'Thử lại cùng phân công' })).not.toBeInTheDocument()
    expect(api.post).toHaveBeenCalledTimes(1)
  })
  it.each([
    { assigneeId: 'persisted-staff' },
    { assigneeId: 'persisted-staff', dueAt: '2026-10-26T14:30:00+07:00' },
  ])('retries locked persisted intent after reload: %j', async (assignmentIntent) => {
    current = { ...current, executionStatus: 'ASSIGNING', assignmentIntent }
    await act(async () => {
      page()
    })
    const retry = await screen.findByRole('button', { name: 'Thử lại cùng phân công' })
    expect(screen.getByText('Nhân viên đã lưu: persisted-staff')).toBeInTheDocument()
    expect(screen.queryByText(/Máy chủ chưa cung cấp/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Nhân viên dịch vụ')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Hạn hoàn thành/)).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalledWith('/service-orders/order-1/assignees')
    expect(api.post).not.toHaveBeenCalled()
    fireEvent.click(retry)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Nhân viên: persisted-staff')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận phân công' }))
    await screen.findByText('Công việc liên kết: task-1')
    expect(api.post).toHaveBeenCalledExactlyOnceWith(
      '/service-orders/order-1/assignment',
      assignmentIntent,
    )
  })
  it('does not invent intent after reload in ASSIGNING', async () => {
    current = { ...current, executionStatus: 'ASSIGNING' }
    page()
    await screen.findByText(/Máy chủ chưa cung cấp/)
    expect(screen.queryByLabelText('Nhân viên dịch vụ')).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })
  it('disables assignment while assignees load and handles empty/error', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(api.get).mockImplementation((url) =>
      url.toString().endsWith('/assignees')
        ? new Promise((resolve) => {
            finish = resolve
          })
        : Promise.resolve({ data: current }),
    )
    page()
    await screen.findByText('Đang tải nhân viên dịch vụ…')
    expect(screen.getByRole('button', { name: 'Xem lại phân công' })).toBeDisabled()
    await act(async () => finish({ data: { items: [] } }))
    await screen.findByText('Không có nhân viên dịch vụ đang hoạt động.')
  })
})

describe('history', () => {
  it.each(['OPERATIONS_STAFF', 'MANAGER', 'RECEPTIONIST', 'CUSTOMER', 'CUSTOM_ROLE', null])(
    'denies %s despite identical permissions',
    async (role) => {
      for (const path of ['/staff/service-history', '/staff/service-history/order-1']) {
        const view = page(path, role)
        await screen.findByText(role ? 'Không có quyền truy cập' : 'Login')
        view.unmount()
      }
      expect(api.get).not.toHaveBeenCalled()
    },
  )
  it.each(['SERVICE_STAFF', 'OPERATIONS_STAFF', 'MANAGER'])(
    'menu history exact role %s',
    (role) => {
      renderWithAuth([{ path: '/', element: <UserMenu /> }], {
        auth: { me: { ...ME, role }, status: 'authenticated' },
      })
      expect(Boolean(screen.queryByRole('link', { name: 'Lịch sử thực hiện dịch vụ' }))).toBe(
        role === 'SERVICE_STAFF',
      )
    },
  )
  it('filters inclusive dates using ISO, paginates and resets page for limit', async () => {
    page('/staff/service-history', 'SERVICE_STAFF')
    await screen.findByRole('link', { name: 'Giặt ủi' })
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/service-orders/history/me', {
        params: { page: 2, limit: 20 },
      }),
    )
    fireEvent.change(screen.getByLabelText('Từ khóa dịch vụ'), { target: { value: ' giặt.* ' } })
    fireEvent.change(screen.getByLabelText('Hoàn thành từ ngày'), {
      target: { value: '2026-10-20' },
    })
    fireEvent.change(screen.getByLabelText('Hoàn thành đến ngày'), {
      target: { value: '2026-10-24' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/service-orders/history/me', {
        params: {
          page: 1,
          limit: 20,
          keyword: 'giặt.*',
          from: new Date('2026-10-20T00:00:00').toISOString(),
          to: new Date('2026-10-24T23:59:59.999').toISOString(),
        },
      }),
    )
    fireEvent.change(screen.getByLabelText('Số kết quả mỗi trang'), { target: { value: '10' } })
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/service-orders/history/me', {
        params: expect.objectContaining({ page: 1, limit: 10 }),
      }),
    )
    expect(screen.queryByText(/Private name/)).not.toBeInTheDocument()
  })
  it('limits history keywords to the API contract and rejects oversized input before requesting', async () => {
    page('/staff/service-history', 'SERVICE_STAFF')
    await screen.findByRole('link', { name: 'Giặt ủi' })
    const keyword = screen.getByLabelText('Từ khóa dịch vụ')
    expect(keyword).toHaveAttribute('maxlength', '100')
    fireEvent.change(keyword, { target: { value: 'a'.repeat(101) } })
    const calls = vi.mocked(api.get).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Từ khóa dịch vụ tối đa 100 ký tự.')
    expect(api.get).toHaveBeenCalledTimes(calls)
    fireEvent.change(keyword, { target: { value: 'a'.repeat(100) } })
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/service-orders/history/me', {
        params: { page: 1, limit: 20, keyword: 'a'.repeat(100) },
      }),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('loads detail by order ID, renders result as text, links own source and stays read only', async () => {
    page('/staff/service-history/order-1', 'SERVICE_STAFF')
    expect(await screen.findByText(task.workResult)).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
    expect(api.get).toHaveBeenCalledWith('/service-orders/history/order-1')
    expect(screen.getByRole('link', { name: 'Xem công việc nguồn của tôi' })).toHaveAttribute(
      'href',
      '/staff/tasks/task-1',
    )
    expect(screen.getByRole('link', { name: 'Quay lại lịch sử dịch vụ' })).toHaveAttribute(
      'href',
      '/staff/service-history',
    )
    expect(screen.queryByText(/Private name/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
    expect(api.patch).not.toHaveBeenCalled()
  })
  it('handles foreign own-ID 404 without leaking task link', async () => {
    vi.mocked(api.get).mockRejectedValue({ isAxiosError: true, response: { status: 404 } })
    page('/staff/service-history/foreign', 'SERVICE_STAFF')
    expect(await screen.findByRole('alert')).toHaveTextContent('không thuộc tài khoản')
    expect(
      screen.queryByRole('link', { name: 'Xem công việc nguồn của tôi' }),
    ).not.toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(1)
  })
  it('shows loading, empty and recoverable error', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(api.get).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    page('/staff/service-history', 'SERVICE_STAFF')
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải')
    await act(async () => finish({ data: { items: [], total: 0, page: 1, limit: 20 } }))
    await screen.findByText('Không có lịch sử dịch vụ phù hợp.')
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại lịch sử' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('link', { name: 'Giặt ủi' })
  })
  it('isolates keys by actor role filters and order', () => {
    expect(historyKeys.scope('a', 'SERVICE_STAFF')).not.toEqual(
      historyKeys.scope('b', 'SERVICE_STAFF'),
    )
    expect(historyKeys.scope('a', 'SERVICE_STAFF')).not.toEqual(
      historyKeys.scope('a', 'OPERATIONS_STAFF'),
    )
    expect(historyKeys.list('a', 'SERVICE_STAFF', { page: 1, limit: 20 })).not.toEqual(
      historyKeys.list('a', 'SERVICE_STAFF', { page: 2, limit: 20 }),
    )
    expect(historyKeys.detail('a', 'SERVICE_STAFF', 'one')).not.toEqual(
      historyKeys.detail('a', 'SERVICE_STAFF', 'two'),
    )
  })
})
