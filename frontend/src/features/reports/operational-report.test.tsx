import { configure, fireEvent, screen, within, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { reportRoutes } from './routes'
import type { OperationalReport } from './operational-api'
import {
  ROOM_LABELS,
  TASK_LABELS,
  BOOKING_LABELS,
  ISSUE_LABELS,
  REVIEW_LABELS,
  EXECUTION_LABELS,
  operationalPercent,
} from './operational-presentation'
import roomContract from '../../../../backend/src/common/constants/room-status.enum.ts?raw'
import bookingContract from '../../../../backend/src/common/constants/booking-status.enum.ts?raw'
import taskContract from '../../../../backend/src/modules/tasks/task-contract.ts?raw'
import issueContract from '../../../../backend/src/modules/issues/schemas/issue.schema.ts?raw'
import orderContract from '../../../../backend/src/modules/service-orders/service-order-status.ts?raw'
const root = '/manager/reports/operational'
const report: OperationalReport = {
  period: {
    from: '2026-10-01',
    to: '2026-10-03',
    granularity: 'day',
    timezone: 'Asia/Ho_Chi_Minh',
    days: 3,
  },
  generatedAt: '2026-10-25T03:25:00Z',
  hasPeriodData: true,
  bookings: { available: true, created: 3, checkedIn: 2, checkedOut: 1, cancelled: 0 },
  occupancy: {
    available: true,
    occupiedRoomNights: 15,
    availableRoomNights: 12,
    rate: 1.25,
    note: 'Ước tính từ số phòng hiện tại',
  },
  roomsSnapshot: {
    available: true,
    asOf: '2026-10-25T03:25:00Z',
    activeTotal: 4,
    byStatus: { AVAILABLE: 1, OCCUPIED: 1, CLEANING: 1, MAINTENANCE: 1 },
  },
  serviceOrders: {
    available: true,
    created: 2,
    byReviewStatus: { PENDING_REVIEW: 2, ACCEPTING: 0, ACCEPTED: 0, REJECTED: 0 },
    byExecutionStatus: { NOT_STARTED: 2, ASSIGNING: 0, ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 0 },
  },
  issues: {
    available: true,
    reported: 1,
    closed: 1,
    byStatus: { CLOSED: 1 },
    byCategory: [{ category: 'Danh mục mới', count: 1 }],
    avgResolutionHours: 2.5,
  },
  maintenance: {
    available: true,
    reported: 2,
    preventsSafeUse: 1,
    requiresAction: 1,
    byStatus: { ASSIGNED: 1, IN_PROGRESS: 0, COMPLETED: 0, NO_ACTION: 1 },
    unknownStatus: 0,
  },
  tasks: {
    available: true,
    period: {
      assigned: 2,
      completed: 1,
      byTaskType: [{ taskType: 'Loại mới', count: 2 }],
      bySourceType: [{ sourceType: 'NEW_SOURCE', count: 2 }],
      avgCompletionHours: 3.5,
    },
    snapshot: { asOf: '2026-10-25T03:25:00Z', assigned: 2, inProgress: 1, overdue: 1 },
  },
  series: [
    {
      bucket: '2026-10-01',
      bookingsCreated: 3,
      checkIns: 2,
      serviceOrdersCreated: 2,
      issuesReported: 1,
      maintenanceReported: 2,
      tasksCompleted: 1,
    },
    {
      bucket: '2026-10-02',
      bookingsCreated: 0,
      checkIns: 0,
      serviceOrdersCreated: 0,
      issuesReported: 0,
      maintenanceReported: 0,
      tasksCompleted: 0,
    },
  ],
}
function renderPage(path = root + '?from=2026-10-01&to=2026-10-03', role = 'MANAGER') {
  return renderWithAuth(reportRoutes, {
    path,
    auth: { me: { ...ME, role, permissions: ['report:view'] }, status: 'authenticated' },
  })
}
describe('UC57 labels and report', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: report })
  })
  afterEach(() => vi.restoreAllMocks())
  it('matches every actual backend status enum', () => {
    for (const [contract, name, labels] of [
      [roomContract, 'RoomStatus', ROOM_LABELS],
      [bookingContract, 'BookingStatus', BOOKING_LABELS],
      [taskContract, 'TaskStatus', TASK_LABELS],
      [issueContract, 'IssueStatus', ISSUE_LABELS],
      [orderContract, 'ServiceOrderReviewStatus', REVIEW_LABELS],
      [orderContract, 'ServiceOrderExecutionStatus', EXECUTION_LABELS],
    ] as const) {
      const block = contract.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\}`))![1]
      expect(Object.keys(labels).sort()).toEqual(
        [...block.matchAll(/=\s*'([^']+)'/g)].map((m) => m[1]).sort(),
      )
    }
  })
  it('renders separate period and snapshots, free strings, all columns and uncapped occupancy', async () => {
    renderPage()
    await screen.findByRole('table', { name: 'Dữ liệu vận hành theo thời gian' })
    expect(screen.getByRole('heading', { name: 'Theo kỳ đã chọn' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tại thời điểm xem báo cáo' })).toBeInTheDocument()
    expect(screen.getByText('125,0%')).toBeInTheDocument()
    expect(screen.getByText(/Công suất ước tính vượt/)).toBeInTheDocument()
    for (const text of ['Danh mục mới', 'Loại mới', 'NEW_SOURCE'])
      expect(screen.getByText(text)).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(7)
    fireEvent.change(screen.getByLabelText('Chỉ số biểu đồ'), {
      target: { value: 'tasksCompleted' },
    })
    expect(screen.getByRole('img', { name: /Task hoàn thành/ })).toBeInTheDocument()
    expect(operationalPercent(null)).toBe('Không xác định')
    expect(screen.getAllByText(/Cập nhật lúc 10:25/).length).toBeGreaterThan(0)
  })
  it('submits only period parameters and keeps them in URL', async () => {
    const { router } = renderPage()
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText(/Từ ngày/), { target: { value: '02/10/2026' } })
    fireEvent.change(screen.getByLabelText('Gộp theo'), { target: { value: 'month' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
    await waitFor(() =>
      expect(router.state.location.search).toBe('?from=2026-10-02&to=2026-10-03&granularity=month'),
    )
    expect(api.get).toHaveBeenLastCalledWith('/reports/operational', {
      params: { from: '2026-10-02', to: '2026-10-03', granularity: 'month' },
    })
  })
  it.each([
    ['04/10/2026', '03/10/2026', 'trước'],
    ['01/01/2024', '01/01/2025', '366'],
    ['30/02/2026', '03/10/2026', 'hợp lệ'],
  ])('validates %s %s beside inputs', async (from, to, message) => {
    renderPage()
    await screen.findByRole('table')
    const count = vi.mocked(api.get).mock.calls.length
    fireEvent.change(screen.getByLabelText(/Từ ngày/), { target: { value: from } })
    fireEvent.change(screen.getByLabelText(/Đến ngày/), { target: { value: to } })
    fireEvent.click(screen.getByRole('button', { name: 'Xem báo cáo' }))
    expect(screen.getAllByText(new RegExp(message)).length).toBeGreaterThan(0)
    expect(api.get).toHaveBeenCalledTimes(count)
  })
  it('keeps snapshots for an empty period', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...report, hasPeriodData: false } })
    renderPage()
    await screen.findByText('Không có dữ liệu vận hành trong kỳ đã chọn')
    expect(screen.getByRole('heading', { name: 'Phòng hiện tại' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it('shows missing sources instead of zero values', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...report,
        serviceOrders: { available: false, reason: 'not_available' },
        roomsSnapshot: { available: false, reason: 'not_available' },
      },
    })
    renderPage()
    await screen.findAllByText('Chưa có dữ liệu nguồn cho mục này')
    expect(
      within(screen.getByRole('region', { name: 'Yêu cầu dịch vụ' })).queryByText('0'),
    ).not.toBeInTheDocument()
  })
  it('keeps form while loading and supports retry on errors', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'))
    renderPage()
    await screen.findByRole('button', { name: 'Thử lại' })
    expect(screen.getByLabelText(/Từ ngày/)).toHaveValue('01/10/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('table')
  })
  it('places backend 400 beside both date fields', async () => {
    vi.mocked(api.get).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { message: 'Kỳ không hợp lệ' } },
    })
    renderPage()
    await screen.findByRole('button', { name: 'Thử lại' })
    expect(screen.getAllByText('Kỳ không hợp lệ').length).toBeGreaterThanOrEqual(3)
  })
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'blocks %s despite report:view permission',
    async (role) => {
      renderPage(undefined, role)
      await screen.findByText(/không có quyền/i)
      expect(api.get).not.toHaveBeenCalled()
    },
  )
  it('adds Manager menu link', async () => {
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: { ...ME, role: 'MANAGER' }, status: 'authenticated' },
    })
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('link', { name: 'Báo cáo vận hành' })).toHaveAttribute(
      'href',
      root,
    )
  })
})
