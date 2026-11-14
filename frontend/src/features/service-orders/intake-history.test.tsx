import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { serviceOrderRoutes } from './routes'

vi.mock('@/lib/api-client', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const order = {
  id: 'order-1',
  bookingId: 'booking-1',
  serviceId: 'service-1',
  service: { name: 'Giặt ủi', unit: 'kg' },
  quantity: 1,
  unitPriceVND: 26000,
  amount: 26000,
  requestedTime: '2026-11-01T12:00:00Z',
  createdAt: '2026-11-01T10:00:00Z',
  reviewStatus: 'ACCEPTED',
  executionStatus: 'COMPLETED',
  intakeMode: 'COMPLETED_ON_SITE',
  actualCompletedAt: '2026-11-01T12:00:00Z',
  actualPerformerId: 'actual-person',
  completionDetails: 'Đã giao tại chỗ',
  task: null,
  customer: { id: null, fullName: null },
  booking: null,
  feeRequired: true,
  billingStatus: 'BILLED',
}
function page(path: string, role = 'SERVICE_STAFF') {
  return renderWithAuth(serviceOrderRoutes, {
    path,
    auth: { me: { ...ME, role }, status: 'authenticated' },
  })
}
beforeEach(() => vi.resetAllMocks())
it('shows intake context on reception detail and never offers assignment for completed-on-site', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      ...order,
      reportedBy: 'reporter',
      createdBy: 'creator',
      requesterName: 'Khách nhờ giặt',
      roomId: 'room-1',
      actualPerformerId: 'performer',
    },
  })
  page('/staff/service-orders/order-1', 'RECEPTIONIST')
  expect(await screen.findByText('Người yêu cầu: Khách nhờ giặt')).toBeInTheDocument()
  expect(screen.getByText('Người ghi nhận: reporter')).toBeInTheDocument()
  expect(screen.getByText('Người tạo: creator')).toBeInTheDocument()
  expect(screen.getByText('Phòng yêu cầu: room-1')).toBeInTheDocument()
  expect(screen.getByText('Người thực hiện thực tế: performer')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Phân công dịch vụ' })).not.toBeInTheDocument()
})
it.each(['IN_PROGRESS', 'COMPLETED'])(
  'never offers reassignment after progress: %s',
  async (status) => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...order,
        intakeMode: 'UNPERFORMED',
        executionStatus: status,
        task: { id: 'task-1', status, assigneeId: 'previous', assignedAt: order.createdAt },
      },
    })
    page('/staff/service-orders/order-1', 'RECEPTIONIST')
    await screen.findByRole('heading', { name: 'Phân công dịch vụ' })
    expect(screen.queryByLabelText('Nhân viên thay thế')).not.toBeInTheDocument()
    expect(vi.mocked(api.get).mock.calls.some(([url]) => String(url).endsWith('/assignees'))).toBe(
      false,
    )
  },
)
it('renders completed-on-site history without a task or a source task link', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: order })
  page('/staff/service-history/order-1')
  expect(await screen.findByText('Đã giao tại chỗ')).toBeInTheDocument()
  expect(screen.getByText('Người thực hiện thực tế: actual-person')).toBeInTheDocument()
  expect(screen.queryByText('Xem công việc nguồn của tôi')).not.toBeInTheDocument()
  expect(screen.queryByText(/^Thời gian yêu cầu:/)).not.toBeInTheDocument()
  expect(screen.getByText(/^Thời điểm ghi nhận:/)).toBeInTheDocument()
  expect(screen.getByText(/Không tạo công việc phân công/)).toBeInTheDocument()
})
it('integrates reporter-only records into the existing service history context', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data:
      url === '/service-orders/reports/me'
        ? { items: [order], page: 1, limit: 20, total: 1 }
        : { items: [], total: 0, page: 1, limit: 20 },
  }))
  page('/staff/service-history')
  fireEvent.click(await screen.findByRole('link', { name: 'Yêu cầu tôi ghi nhận' }))
  expect(await screen.findByRole('link', { name: 'Giặt ủi' })).toHaveAttribute(
    'href',
    '/staff/service-history/reports/order-1',
  )
  expect(api.get).toHaveBeenCalledWith('/service-orders/reports/me', expect.anything())
})
it('reassigns a canonical assigned task with expected assignee and stable retry payload', async () => {
  const assigned = {
    ...order,
    intakeMode: 'UNPERFORMED',
    executionStatus: 'ASSIGNED',
    task: {
      id: 'task-1',
      status: 'ASSIGNED',
      assigneeId: 'previous',
      assigneeName: 'Cũ',
      assignedAt: order.createdAt,
      reassignments: [],
    },
  }
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: String(url).endsWith('/assignees')
      ? { items: [{ id: 'next', displayName: 'Mới', role: 'SERVICE_STAFF' }] }
      : assigned,
  }))
  vi.mocked(api.post).mockRejectedValue(new Error('Mạng lỗi'))
  page('/staff/service-orders/order-1', 'RECEPTIONIST')
  fireEvent.change(await screen.findByLabelText('Nhân viên thay thế'), {
    target: { value: 'next' },
  })
  fireEvent.change(screen.getByLabelText('Lý do đổi phân công'), { target: { value: 'Đổi ca' } })
  fireEvent.click(screen.getByRole('button', { name: 'Đổi phân công' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại đổi phân công' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
  const calls = vi.mocked(api.post).mock.calls
  expect(calls[0][0]).toBe('/service-orders/order-1/reassignment')
  expect(calls[0][1]).toEqual(calls[1][1])
  expect(calls[0][1]).toMatchObject({
    assigneeId: 'next',
    expectedAssigneeId: 'previous',
    reason: 'Đổi ca',
    requestId: expect.any(String),
  })
})
