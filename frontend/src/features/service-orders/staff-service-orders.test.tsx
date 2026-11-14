import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { StaffServiceOrdersPage } from './pages/StaffServiceOrdersPage'
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
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đơn' }))
}
beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    },
  })
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

it.each([{ items: [] }, { items: [receipt] }])(
  'keeps error exclusive after initial failure and stale refetch, then recovers with cache $items.length',
  async ({ items }) => {
    function ListWithRefresh() {
      const client = useQueryClient()
      return (
        <>
          <button onClick={() => void client.invalidateQueries()}>Refresh test query</button>
          <StaffServiceOrdersPage />
        </>
      )
    }
    vi.mocked(api.get).mockRejectedValueOnce(httpError(500))
    renderWithAuth([{ path: '/', element: <ListWithRefresh /> }], {
      auth: { status: 'authenticated', me: receptionist },
    })
    await screen.findByRole('alert')
    expect(screen.queryByText('Không có yêu cầu dịch vụ phù hợp.')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    vi.mocked(api.get).mockResolvedValue({
      data: { items, page: 1, limit: 20, total: items.length },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại trạng thái' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    if (items.length) await screen.findByRole('link', { name: receipt.service.name })
    else await screen.findByText('Không có yêu cầu dịch vụ phù hợp.')
    vi.mocked(api.get).mockRejectedValue(httpError(500))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh test query' }))
    await screen.findByRole('alert')
    expect(screen.queryByText('Không có yêu cầu dịch vụ phù hợp.')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: receipt.service.name })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    let resolve!: (value: unknown) => void
    vi.mocked(api.get).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại trạng thái' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(4))
    expect(screen.queryByText('Không có yêu cầu dịch vụ phù hợp.')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: receipt.service.name })).not.toBeInTheDocument()
    await act(async () => resolve({ data: { items: [receipt], page: 1, limit: 20, total: 1 } }))
    expect(await screen.findByRole('link', { name: receipt.service.name })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Không có yêu cầu dịch vụ phù hợp.')).not.toBeInTheDocument()
    expect(api.get).toHaveBeenLastCalledWith('/service-orders/requests', {
      params: { page: 1, limit: 20, reviewStatus: 'PENDING_REVIEW' },
    })
  },
)

it('shows names and booking context without technical customer, reviewer or task IDs', async () => {
  current = {
    ...receipt,
    ...{ bookingCode: 'BK001', roomNumbers: ['201', '202'] },
    reviewStatus: 'ACCEPTED',
    executionStatus: 'ASSIGNED',
    review: {
      decision: 'ACCEPT',
      reviewedBy: 'reviewer-id',
      reviewedAt: receipt.createdAt,
      ...{ reviewedByName: 'Trần Bình' },
    },
    task: {
      id: 'task-id',
      assigneeId: 'assignee-id',
      assignedAt: receipt.createdAt,
      status: 'ASSIGNED',
      ...{ assigneeName: 'Lê Mai' },
    },
  }
  page()
  expect(await screen.findByText('Người duyệt: Trần Bình')).toBeInTheDocument()
  expect(screen.getByText('Nhân viên: Lê Mai')).toBeInTheDocument()
  expect(screen.getByText('Quyết định đã lưu: Chấp nhận')).toBeInTheDocument()
  expect(screen.getByText('201, 202')).toBeInTheDocument()
  for (const value of [
    'customer-1',
    'reviewer-id',
    'task-id',
    'assignee-id',
    receipt.id,
    receipt.bookingId,
  ]) {
    expect(document.body).not.toHaveTextContent(value)
  }
})

it('never falls back to reviewer or assignee IDs when names are missing', async () => {
  current = {
    ...receipt,
    reviewStatus: 'ACCEPTED',
    executionStatus: 'ASSIGNED',
    review: {
      decision: 'REJECT',
      reviewedBy: 'reviewer-id',
      reviewedAt: receipt.createdAt,
      reviewedByName: null,
    },
    task: {
      id: 'task-id',
      assigneeId: 'assignee-id',
      assignedAt: receipt.createdAt,
      status: 'ASSIGNED',
      assigneeName: null,
    },
  }
  page()
  expect(await screen.findByText('Người duyệt: Chưa có tên người duyệt')).toBeInTheDocument()
  expect(screen.getByText('Nhân viên: Chưa có tên nhân viên')).toBeInTheDocument()
  expect(screen.getByText('Quyết định đã lưu: Từ chối')).toBeInTheDocument()
  for (const value of ['reviewer-id', 'task-id', 'assignee-id']) {
    expect(document.body).not.toHaveTextContent(value)
  }
})

it('shows a service-first review table with long names, multiple rooms and free onsite context', async () => {
  const name = 'Dịch vụ chăm sóc khách lưu trú '.repeat(12).trim()
  current = {
    ...receipt,
    service: { name, unit: 'lần' },
    customer: { id: 'customer-1', fullName: null },
    booking: { ...receipt.booking!, roomNumbers: ['201', '202', '203'] },
    feeRequired: false,
    amount: 0,
    intakeMode: 'COMPLETED_ON_SITE',
    actualCompletedAt: receipt.requestedTime,
  }
  page('/staff/service-orders')
  const table = await screen.findByRole('table', { name: 'Yêu cầu dịch vụ' })
  expect(within(table).getByRole('columnheader', { name: 'Trạng thái duyệt' })).toBeInTheDocument()
  expect(within(table).getByRole('columnheader', { name: 'Thực hiện' })).toBeInTheDocument()
  expect(await within(table).findByRole('link', { name })).toHaveAttribute(
    'href',
    '/staff/service-orders/order-1',
  )
  expect(within(table).getByText('Chưa có tên khách hàng')).toBeInTheDocument()
  expect(within(table).getByText('Phòng: 201, 202, 203')).toBeInTheDocument()
  expect(within(table).getAllByText('Không tính phí').length).toBeGreaterThan(0)
  expect(within(table).getByText(/Không tạo công việc phân công/)).toBeInTheDocument()
  expect(within(table).getByText(/Thời điểm hoàn thành thực tế:/)).toBeInTheDocument()
  expect(within(table).queryByText(/Thời gian yêu cầu:/)).not.toBeInTheDocument()
})

it.each([
  ['PENDING_REVIEW', 'NOT_STARTED', 'NOT_REQUIRED', 'Chờ duyệt', 'Chưa bắt đầu', 'Chưa ghi phí'],
  [
    'ACCEPTING',
    'NOT_STARTED',
    'PENDING',
    'Đang chấp nhận · chờ hoàn tất ghi phí',
    'Chưa bắt đầu',
    'Chờ ghi phí vào hóa đơn',
  ],
  [
    'ACCEPTED',
    'ASSIGNING',
    'BILLED',
    'Đã chấp nhận',
    'Đang phân công',
    'Đã ghi vào hóa đơn · không xác nhận thanh toán',
  ],
  ['ACCEPTED', 'ASSIGNED', 'PENDING', 'Đã chấp nhận', 'Đã phân công', 'Chờ ghi phí vào hóa đơn'],
  [
    'ACCEPTED',
    'IN_PROGRESS',
    'BILLED',
    'Đã chấp nhận',
    'Đang thực hiện',
    'Đã ghi vào hóa đơn · không xác nhận thanh toán',
  ],
  [
    'ACCEPTED',
    'COMPLETED',
    'BILLED',
    'Đã chấp nhận',
    'Đã hoàn thành',
    'Đã ghi vào hóa đơn · không xác nhận thanh toán',
  ],
  [
    'REJECTED',
    'NOT_STARTED',
    'NOT_REQUIRED',
    'Đã từ chối',
    'Chưa bắt đầu',
    'Không ghi phí · đã từ chối',
  ],
  [
    'ABANDONED',
    'NOT_STARTED',
    'NOT_REQUIRED',
    'Đã dừng kỹ thuật · lịch dịch vụ đã qua',
    'Chưa bắt đầu',
    'Không ghi phí · đã dừng kỹ thuật',
  ],
] as const)(
  'shows Vietnamese review %s and execution %s once while retaining billing %s',
  async (reviewStatus, executionStatus, billingStatus, review, execution, billing) => {
    current = { ...receipt, reviewStatus, executionStatus, billingStatus }
    page('/staff/service-orders')
    const table = await screen.findByRole('table', { name: 'Yêu cầu dịch vụ' })
    const row = await within(table).findByRole('row', { name: /Giặt ủi/ })
    const cells = within(row).getAllByRole('cell')
    expect(cells[0]).toHaveTextContent(review)
    expect(within(cells[0]).getAllByText(review)).toHaveLength(1)
    expect(cells[0]).not.toHaveTextContent('Trạng thái yêu cầu:')
    expect(cells[0]).not.toHaveTextContent(/Accepted|Pending Review|Accepting|Rejected|Abandoned/)
    expect(within(cells[2]).getByText(execution)).toBeInTheDocument()
    expect(within(row).getByText(billing)).toBeInTheDocument()
  },
)

it('retains the unknown business-state warning for inconsistent review and execution', async () => {
  current = { ...receipt, reviewStatus: 'REJECTED', executionStatus: 'ASSIGNED' }
  page('/staff/service-orders')
  const table = await screen.findByRole('table', { name: 'Yêu cầu dịch vụ' })
  expect(await within(table).findByText('Trạng thái yêu cầu: Chưa xác định')).toBeInTheDocument()
})

it('does not label the server default as a scheduled time in onsite detail', async () => {
  current = {
    ...receipt,
    intakeMode: 'COMPLETED_ON_SITE',
    actualCompletedAt: receipt.requestedTime,
  }
  page()
  await screen.findByRole('heading', { name: 'Thông tin ghi nhận' })
  expect(screen.queryByText('Thời gian yêu cầu')).not.toBeInTheDocument()
  expect(screen.queryByText(/^Thời gian yêu cầu:/)).not.toBeInTheDocument()
  expect(screen.getByText(/^Thời điểm ghi nhận:/)).toBeInTheDocument()
  expect(screen.getByText(/Không tạo công việc phân công/)).toBeInTheDocument()
})

describe('expired acceptance abandonment', () => {
  function acceptingOrder() {
    current = {
      ...receipt,
      booking: { ...receipt.booking!, status: 'CONFIRMED' },
      reviewStatus: 'ACCEPTING',
      billingStatus: 'PENDING',
      review: {
        decision: 'ACCEPT',
        reason: 'Original acceptance',
        reviewedBy: 'reviewer-id',
        reviewedByName: 'Trần Bình',
        reviewedAt: receipt.createdAt,
      },
    }
  }
  it('keeps abandoned detail terminal with public reason and separate recovery audit', async () => {
    acceptingOrder()
    current = {
      ...current,
      reviewStatus: 'ABANDONED',
      billingStatus: 'NOT_REQUIRED',
      reviewReason: 'Lịch dịch vụ đã qua',
      acceptanceRecovery: {
        decision: 'REJECT',
        action: 'ABANDON_EXPIRED',
        reason: 'Đã kiểm tra nguồn phí và công việc',
        rejectionReason: 'Lịch dịch vụ đã qua',
        actor: 'recovery-actor',
        actorRole: 'RECEPTIONIST',
        at: receipt.requestedTime,
        previousReviewStatus: 'ACCEPTING',
        resultingReviewStatus: 'ABANDONED',
        evidence: {
          chargeExpected: true,
          sourceChargeAbsent: true,
          taskAbsent: true,
          reviewedBy: 'reviewer-id',
          reviewedAt: receipt.createdAt,
          reviewDecision: 'ACCEPT',
          reviewReason: 'Original acceptance',
        },
      },
    }
    page()
    expect(await screen.findByText('Kết quả duyệt đã hoàn tất, chỉ xem.')).toBeInTheDocument()
    expect(screen.getByText('Lý do từ chối: Lịch dịch vụ đã qua')).toBeInTheDocument()
    expect(screen.getByText('Người duyệt: Trần Bình')).toBeInTheDocument()
    expect(screen.getByText('Lý do đã lưu: Original acceptance')).toBeInTheDocument()
    expect(
      screen.getByText('Lý do khôi phục nội bộ: Đã kiểm tra nguồn phí và công việc'),
    ).toBeInTheDocument()
    expect(screen.getByText('Vai trò thực hiện: Lễ tân')).toBeInTheDocument()
    expect(screen.getByText('Không ghi phí · đã dừng kỹ thuật')).toBeInTheDocument()
    expect(screen.queryByLabelText('Quyết định')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Phân công|Gửi đơn/ })).not.toBeInTheDocument()
    expect(api.patch).not.toHaveBeenCalled()
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/assignees'))
  })
  it('requires explicit recovery, both reasons and confirmation, and freezes the identical payload on unknown outcome', async () => {
    acceptingOrder()
    vi.mocked(api.patch).mockRejectedValue(httpError(503))
    page()
    await screen.findByLabelText('Quyết định')
    expect(screen.getByLabelText('Quyết định')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Dừng kỹ thuật lịch dịch vụ đã qua' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đơn' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nhập lý do công khai và lý do khôi phục nội bộ',
    )
    fireEvent.change(screen.getByLabelText(/Lý do \(bắt buộc/), {
      target: { value: ' Lịch đã qua ' },
    })
    fireEvent.change(
      screen.getByLabelText('Lý do khôi phục nội bộ (bắt buộc, tối đa 2000 ký tự)'),
      { target: { value: ' Kiểm tra không có phí hoặc công việc ' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đơn' }))
    expect(api.patch).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Máy chủ xác minh')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    const payload = {
      decision: 'REJECT',
      reason: 'Lịch đã qua',
      recoveryReason: 'Kiểm tra không có phí hoặc công việc',
      recoveryAction: 'ABANDON_EXPIRED',
    }
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/service-orders/order-1/review', payload),
    )
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Quyết định')).toBeDisabled()
    expect(screen.getByLabelText(/Lý do \(bắt buộc/)).toBeDisabled()
    expect(
      screen.getByLabelText('Lý do khôi phục nội bộ (bắt buộc, tối đa 2000 ký tự)'),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại cùng nội dung' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.patch).mock.calls[1]).toEqual(vi.mocked(api.patch).mock.calls[0])
  })
  it('filters the staff list by abandoned without losing the terminal label', async () => {
    current = { ...receipt, reviewStatus: 'ABANDONED' }
    page('/staff/service-orders')
    await screen.findByRole('link', { name: 'Giặt ủi' })
    const option = screen.getByRole('option', { name: 'Đã dừng kỹ thuật · lịch dịch vụ đã qua' })
    fireEvent.change(option.closest('select')!, { target: { value: 'ABANDONED' } })
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/service-orders/requests', {
        params: { page: 1, limit: 20, reviewStatus: 'ABANDONED' },
      }),
    )
    expect(document.body).not.toHaveTextContent('Chưa xác định')
  })
  it.each(['', ' ', 'x'.repeat(2001)])(
    'rejects invalid private recovery reason before PATCH: %s',
    async (recoveryReason) => {
      await expect(
        reviewStaffOrder('order-1', {
          decision: 'REJECT',
          reason: 'Public reason',
          recoveryAction: 'ABANDON_EXPIRED',
          recoveryReason,
        }),
      ).rejects.toThrow()
      expect(api.patch).not.toHaveBeenCalled()
    },
  )
  it.each(['CHECKED_IN', 'CHECKED_OUT'])(
    'does not offer expired recovery for %s',
    async (status) => {
      acceptingOrder()
      current.booking!.status = status
      page()
      await screen.findByLabelText('Quyết định')
      expect(
        screen.queryByRole('button', { name: 'Dừng kỹ thuật lịch dịch vụ đã qua' }),
      ).not.toBeInTheDocument()
      expect(screen.getByLabelText('Quyết định')).toBeDisabled()
    },
  )
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
describe('receptionist room context', () => {
  it.each([
    ['single', ['101']],
    ['multiple', ['202', '101', '303']],
    ['empty', []],
    ['missing', undefined],
    ['long', Array.from({ length: 100 }, (_, index) => `Tầng-dài-${index + 1}`)],
  ] as const)('renders all rooms in server order: %s', async (_name, numbers) => {
    const booking = { ...receipt.booking!, roomNumbers: numbers ? [...numbers] : undefined }
    current = { ...receipt, booking }
    page('/staff/service-orders')
    const item = (await screen.findByRole('link', { name: 'Giặt ủi' })).closest('tr')!
    expect(
      within(item).getByText(`Phòng: ${numbers?.length ? numbers.join(', ') : '—'}`),
    ).toBeInTheDocument()
    expect(within(item).getByRole('rowheader')).toHaveClass('break-words')
    expect(within(item).getByText('Đặt phòng: BK001')).toBeInTheDocument()
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('keeps missing bookings explicit without inventing a room', async () => {
    current = { ...receipt, booking: null }
    page('/staff/service-orders')
    await screen.findByRole('link', { name: 'Giặt ủi' })
    expect(screen.getByText('Phòng: —')).toBeInTheDocument()
    expect(screen.getByText('Đặt phòng: Không còn thông tin đặt phòng')).toBeInTheDocument()
  })

  it('preserves server item ordering without client sorting by room', async () => {
    const items = [
      {
        ...receipt,
        id: 'z',
        service: { ...receipt.service, name: 'Đơn trước' },
        booking: { ...receipt.booking!, roomNumbers: ['909'] },
      },
      {
        ...receipt,
        id: 'a',
        service: { ...receipt.service, name: 'Đơn sau' },
        booking: { ...receipt.booking!, roomNumbers: ['101'] },
      },
    ]
    vi.mocked(api.get).mockResolvedValue({ data: { items, page: 1, limit: 20, total: 2 } })
    page('/staff/service-orders')
    await screen.findByRole('link', { name: 'Đơn trước' })
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Đơn trước')
    expect(rows[0]).toHaveTextContent('Phòng: 909')
    expect(rows[1]).toHaveTextContent('Đơn sau')
    expect(rows[1]).toHaveTextContent('Phòng: 101')
  })
})

describe('staff list and detail', () => {
  it('uses workspace list presentation without losing customer, billing or detail navigation', async () => {
    const name = 'Dịch vụ dài '.repeat(40).trim()
    current = { ...current, service: { ...current.service, name }, booking: null }
    page('/staff/service-orders')
    const link = await screen.findByRole('link', { name })
    expect(screen.getByRole('heading', { level: 1, name: 'Yêu cầu dịch vụ' })).toHaveClass(
      'text-2xl',
    )
    expect(link.closest('.card-soft')).toBeInTheDocument()
    expect(link.closest('th')).toHaveClass('break-words')
    expect(link).toHaveAttribute('href', '/staff/service-orders/order-1')
    expect(screen.getByLabelText('Từ khóa dịch vụ')).toHaveClass('border-input')
    expect(screen.getByLabelText('Từ khóa dịch vụ')).toHaveAttribute('maxlength', '100')
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toHaveClass('rounded-full')
    expect(screen.getByText(/Nguyễn An/)).not.toHaveTextContent('customer-1')
    expect(screen.getByText(/Không còn thông tin đặt phòng/)).toBeInTheDocument()
    expect(screen.getByText('Chưa ghi phí')).toBeInTheDocument()
    expect(screen.getByText(/Thời gian yêu cầu:/)).toBeInTheDocument()
    expect(api.patch).not.toHaveBeenCalled()
  })
  it('retains previous-page navigation and disables it during refresh', async () => {
    vi.mocked(api.get).mockImplementation(async (_url, config) => ({
      data: {
        items: [current],
        page: (config?.params as { page?: number } | undefined)?.page ?? 1,
        limit: 20,
        total: 41,
      },
    }))
    page('/staff/service-orders')
    await screen.findByRole('link', { name: 'Giặt ủi' })
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await screen.findByText('Trang 2 · 41 yêu cầu')
    fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }))
    await screen.findByText('Trang 1 · 41 yêu cầu')
    expect(api.get).toHaveBeenLastCalledWith('/service-orders/requests', {
      params: { page: 1, limit: 20, reviewStatus: 'PENDING_REVIEW' },
    })
  })

  it.each([
    ['ACCEPTING', 'NOT_STARTED', 'Đang chấp nhận · chờ hoàn tất ghi phí'],
    ['ACCEPTED', 'ASSIGNING', 'Đang phân công'],
    ['ACCEPTED', 'ASSIGNED', 'Đã phân công'],
    ['REJECTED', 'COMPLETED', 'Trạng thái yêu cầu: Chưa xác định'],
  ] as const)(
    'shows distinct staff list state for %s / %s',
    async (reviewStatus, executionStatus, label) => {
      current = { ...current, reviewStatus, executionStatus }
      page('/staff/service-orders')
      const table = await screen.findByRole('table', { name: 'Yêu cầu dịch vụ' })
      expect(await within(table).findByText(label)).toBeInTheDocument()
    },
  )
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
    await screen.findByText(/Chưa có tên khách hàng/)
    expect(screen.getByText('Không còn thông tin đặt phòng.')).toBeInTheDocument()
    expect(screen.getByText('2 kg')).toBeInTheDocument()
    expect(screen.getByText(/26\.000/)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/service-orders/requests/order-1')
    expect(screen.queryByRole('link', { name: /hóa đơn/ })).not.toBeInTheDocument()
  })
})
describe('review safety', () => {
  it('uses workspace panels and atomic review controls while keeping the standalone detail', async () => {
    const notes = 'Ghi chú dài\n'.repeat(40).trim()
    current = { ...current, notes }
    page()
    await screen.findByRole('heading', { name: 'Duyệt yêu cầu' })
    expect(screen.getByRole('heading', { level: 1, name: 'Chi tiết yêu cầu dịch vụ' })).toHaveClass(
      'text-2xl',
    )
    for (const name of [
      'Khách hàng và đặt phòng',
      'Giặt ủi',
      'Ghi phí',
      'Duyệt yêu cầu',
      'Phân công dịch vụ',
    ]) {
      expect(screen.getByRole('heading', { name }).closest('.card-soft')).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Quyết định')).toHaveClass('border-input')
    expect(screen.getByLabelText(/Lý do \(bắt buộc/)).toHaveClass('border-input')
    expect(screen.getByText(notes.replace(/\s+/g, ' '))).toHaveClass('whitespace-pre-wrap')
    expect(screen.getByRole('link', { name: 'Yêu cầu dịch vụ' })).toHaveAttribute(
      'href',
      '/staff/service-orders',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Gửi đơn' })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Xác nhận chấp nhận' })
    expect(dialog.tagName).toBe('DIALOG')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(api.patch).not.toHaveBeenCalled()
  })
  it('blocks ACCEPTING without persisted review and keeps manual refresh available', async () => {
    current = { ...current, reviewStatus: 'ACCEPTING', billingStatus: 'PENDING' }
    page()
    expect(await screen.findByRole('button', { name: 'Thử lại cùng nội dung' })).toBeDisabled()
    expect(screen.getByLabelText('Quyết định')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại trạng thái' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(api.patch).not.toHaveBeenCalled()
  })

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
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đơn' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('không ghi phí và không tạo công việc')
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }))
    expect(api.patch).not.toHaveBeenCalled()
    vi.mocked(api.patch).mockImplementationOnce(async () => {
      current = { ...current, reviewStatus: 'REJECTED' }
      return { data: current }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đơn' }))
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
