import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { UserMenu } from '@/features/auth/UserMenu'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { api } from '@/lib/api-client'
import { getIssue, listIssues, type IssueDetail, type IssueQuery } from './api'
import { issueKeys, useIssue } from './hooks'
import { issueRoutes } from './routes'

const detail: IssueDetail = {
  id: 'c'.repeat(24),
  title: 'Điều hòa hỏng',
  category: 'Phòng và tiện nghi',
  description: 'Không làm mát',
  bookingId: 'a'.repeat(24),
  roomId: 'b'.repeat(24),
  priority: 'NORMAL',
  status: 'PENDING_REVIEW',
  reportedAt: '2026-10-24T10:00:00Z',
  concludedAt: '2026-10-25T10:00:00Z',
  linkedTasks: [],
  linkedTasksAvailable: false,
}
const views = [
  ['CUSTOMER', '/customer/issues', 'Sự cố của tôi'],
  ['RECEPTIONIST', '/staff/issues', 'Yêu cầu sự cố'],
  ['MANAGER', '/manager/issues', 'Danh sách sự cố'],
] as const

function page(path: string, role: string | null = 'CUSTOMER') {
  return renderWithAuth([...issueRoutes, { path: '/login', element: <p>Đăng nhập ngay</p> }], {
    path,
    auth: role ? { status: 'authenticated', me: { ...ME, role, permissions: ['issue:read'] } } : {},
  })
}

beforeEach(() => vi.restoreAllMocks())

test.each([
  [{ roomId: detail.roomId, roomNumber: '101' }, 'Phòng 101'],
  [{ roomId: detail.roomId, roomNumber: null }, 'Không có thông tin phòng'],
  [{ roomId: detail.roomId }, 'Không có thông tin phòng'],
  [{ roomId: detail.roomId, roomNumber: '  ' }, 'Không có thông tin phòng'],
  [{ roomId: undefined, roomNumber: null }, 'Không gắn với phòng'],
])('customer list and detail share safe room labels for %j', async (room, label) => {
  const issue = { ...detail, ...room }
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: url === '/issues' ? { items: [issue], total: 1, page: 1, limit: 20 } : issue,
  }))
  page('/customer/issues')
  expect(await screen.findByText(label)).toBeInTheDocument()
  expect(screen.queryByText(detail.roomId!)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: detail.title }))
  expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent(detail.title)
  expect(screen.getByText(label)).toBeInTheDocument()
  expect(screen.queryByText(detail.roomId!)).not.toBeInTheDocument()
  expect(screen.queryByText('Mã phòng tham chiếu')).not.toBeInTheDocument()
  expect(get.mock.calls.map(([url]) => url)).toEqual(['/issues', `/issues/${detail.id}`])
})

test('customer handling history is chronological, localized, read-only and excludes private fields', async () => {
  const types = [
    'REPORTED',
    'REVIEWED',
    'ASSIGNED',
    'CONTINUED',
    'REASSIGNED',
    'TASK_COMPLETED',
    'CLOSED',
  ]
  const labels = [
    'Đã báo sự cố',
    'Đã xem xét',
    'Đã phân công',
    'Tiếp tục xử lý',
    'Đã phân công lại',
    'Đã hoàn thành công việc',
    'Đã đóng sự cố',
  ]
  const events = types.map((type, index) => ({
    type,
    at: `2026-10-${24 + index}T10:00:00Z`,
    actorId: 'PRIVATE ACTOR',
    instructions: 'PRIVATE INSTRUCTIONS',
    reason: 'PRIVATE REASON',
    workResult: 'PRIVATE RESULT',
  }))
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      ...detail,
      roomNumber: '101',
      status: 'CLOSED',
      customerHistory: [...events].reverse(),
      reviewNotes: 'PRIVATE NOTES',
      closureConclusion: 'PRIVATE CONCLUSION',
      reassignmentHistory: [{ reason: 'PRIVATE REASSIGNMENT' }],
      linkedTasksAvailable: true,
      linkedTasks: [{ id: 'PRIVATE TASK', title: 'PRIVATE TASK TITLE' }],
    },
  })
  page(`/customer/issues/${detail.id}`)
  const history = await screen.findByRole('list', { name: 'Lịch sử xử lý' })
  const items = within(history).getAllByRole('listitem')
  expect(items).toHaveLength(7)
  items.forEach((item, index) => {
    expect(item).toHaveTextContent(labels[index])
    expect(item.querySelector('time')).toHaveAttribute('dateTime', events[index].at)
  })
  expect(screen.getByText('Phòng 101')).toBeInTheDocument()
  expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

test.each([
  undefined,
  [],
  [
    { type: 'REPORTED', at: 'invalid' },
    { type: 'CLOSED', at: '' },
    { type: 'ASSIGNED', at: null },
    { type: 'PRIVATE EVENT', at: '2026-10-24T10:00:00Z' },
  ],
])(
  'customer history uses an honest fallback for unavailable events %j',
  async (customerHistory) => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: { ...detail, customerHistory } })
    page(`/customer/issues/${detail.id}`)
    expect(await screen.findByText('Chưa có lịch sử xử lý được cung cấp.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Lịch sử xử lý' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Invalid Date|PRIVATE EVENT/)).not.toBeInTheDocument()
  },
)

test('partial customer history renders only supplied valid public events without inference', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      ...detail,
      status: 'CLOSED',
      customerHistory: [
        { type: 'REPORTED', at: detail.reportedAt },
        { type: 'REVIEWED', at: 'invalid' },
        { type: 'CLOSED' },
      ],
    },
  })
  page(`/customer/issues/${detail.id}`)
  const history = await screen.findByRole('list', { name: 'Lịch sử xử lý' })
  expect(within(history).getAllByRole('listitem')).toHaveLength(1)
  expect(history).toHaveTextContent('Đã báo sự cố')
  expect(history).not.toHaveTextContent('Đã đóng sự cố')
})

test.each(views.slice(1))(
  'keeps %s staff history separate from customer events',
  async (role, path) => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        ...detail,
        customerHistory: [{ type: 'REPORTED', at: detail.reportedAt }],
        reviewNotes: 'Ghi chú nội bộ',
      },
    })
    page(`${path}/${detail.id}`, role)
    expect(await screen.findByText('Ghi chú nội bộ')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Lịch sử xử lý' })).not.toBeInTheDocument()
  },
)

test.each(views)('%s sees exact role title, list and detail', async (role, path, title) => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: url === '/issues' ? { items: [detail], total: 1, page: 1, limit: 20 } : detail,
  }))
  const result = page(path, role)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
  fireEvent.click(await screen.findByRole('link', { name: detail.title }))
  expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent(detail.title)
  expect(screen.getByText(/Điều này không có nghĩa/)).toBeInTheDocument()
  expect(screen.getByText('Ngày kết luận')).toBeInTheDocument()
  expect(screen.getByText(detail.bookingId)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: detail.bookingId })).not.toBeInTheDocument()
  if (role === 'RECEPTIONIST')
    expect(screen.getByRole('button', { name: 'Xem xét' })).toBeInTheDocument()
  else
    expect(screen.queryByRole('button', { name: /Đóng|Phân công|Xem xét/ })).not.toBeInTheDocument()
  expect(result.router.state.location.pathname).toBe(`${path}/${detail.id}`)
})

test.each(views)(
  'guards %s routes against every other role and permission-only access',
  (allowed, path) => {
    const get = vi.spyOn(api, 'get')
    for (const role of [
      'CUSTOMER',
      'RECEPTIONIST',
      'MANAGER',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
      'CUSTOM_STAFF',
    ].filter((role) => role !== allowed)) {
      for (const suffix of ['', '/foreign']) {
        const result = page(`${path}${suffix}`, role)
        expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
        result.unmount()
      }
    }
    expect(get).not.toHaveBeenCalled()
  },
)

test('anonymous deep link redirects and static report wins over detail', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [] } })
  const guest = page('/customer/issues/foreign', null)
  expect(await screen.findByText('Đăng nhập ngay')).toBeInTheDocument()
  expect(get).not.toHaveBeenCalled()
  guest.unmount()
  page('/customer/issues/report?bookingId=context')
  expect(screen.getByRole('heading', { level: 1, name: 'Báo sự cố' })).toBeInTheDocument()
  expect(await screen.findByText('Chỉ dùng được khi đang lưu trú')).toBeInTheDocument()
  expect(get).toHaveBeenCalledExactlyOnceWith('/issues/report-context')
  expect(screen.queryByRole('textbox', { name: /Mã đặt phòng/ })).not.toBeInTheDocument()
})

test.each([
  ['CUSTOMER', '/customer/issues/report', 'Báo sự cố'],
  ['RECEPTIONIST', '/staff/issues', 'Sự cố'],
  ['MANAGER', '/manager/issues', 'Sự cố'],
  ['SERVICE_STAFF', '', ''] as const,
  ['OPERATIONS_STAFF', '', ''] as const,
  ['CUSTOM_STAFF', '', ''] as const,
])('menu is exact-role for %s', (role, path, title) => {
  renderWithAuth([{ path: '/', element: <UserMenu /> }], {
    auth: { status: 'authenticated', me: { ...ME, role, permissions: ['issue:read'] } },
  })
  if (path) {
    expect(screen.getByRole('link', { name: title })).toHaveAttribute('href', path)
  }
  const otherPaths = ['/customer/issues/report', '/staff/issues', '/manager/issues'].filter(
    (p) => p !== path,
  )
  for (const otherPath of otherPaths) {
    const links = screen.queryAllByRole('link')
    expect(links.some((l) => l.getAttribute('href') === otherPath)).toBe(false)
  }
})

test('literal filters, pagination and resets use the live list contract', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { items: [detail], total: 41, page: 1, limit: 20 } })
  page('/customer/issues')
  expect(await screen.findByRole('link', { name: 'Báo sự cố mới' })).toHaveAttribute(
    'href',
    '/customer/issues/report',
  )
  await screen.findByText(detail.title)
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/issues', { params: { page: 2, limit: 20 } }),
  )
  fireEvent.change(screen.getByLabelText('Tìm theo tiêu đề'), { target: { value: '.*[' } })
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/issues', {
      params: { page: 1, limit: 20, keyword: '.*[' },
    }),
  )
  fireEvent.change(screen.getByLabelText('Nhóm sự cố (chính xác)'), {
    target: { value: ' Nhóm riêng ' },
  })
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'PENDING_REVIEW' } })
  fireEvent.change(screen.getByLabelText('Mức ưu tiên'), { target: { value: 'NORMAL' } })
  fireEvent.change(screen.getByLabelText('Số dòng mỗi trang'), { target: { value: '100' } })
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/issues', {
      params: {
        page: 1,
        limit: 100,
        keyword: '.*[',
        category: ' Nhóm riêng ',
        status: 'PENDING_REVIEW',
        priority: 'NORMAL',
      },
    }),
  )
})

test.each(views)(
  '%s list uses the shared workspace presentation without losing long content',
  async (role, path) => {
    const title = 'Sự cố dài '.repeat(60)
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { items: [{ ...detail, title }], total: 1, page: 1, limit: 20 },
    })
    page(path, role)
    const link = await screen.findByRole('link', { name: title.trim() })
    expect(link.closest('li')).toHaveClass('card-soft')
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-2xl')
    expect(screen.getByLabelText('Tìm theo tiêu đề')).toHaveAttribute('maxlength', '200')
    expect(screen.getByRole('navigation', { name: 'Phân trang sự cố' })).toBeInTheDocument()
  },
)

test.each(views)(
  '%s detail uses workspace panels and protects internal audit data',
  async (role, path) => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        ...detail,
        reviewedBy: 'internal-reviewer',
        reviewNotes: 'internal-review-note',
        closureConclusion: 'internal-conclusion',
        closedBy: 'internal-closer',
        assigneeId: 'internal-assignee',
        linkedTasksAvailable: true,
        linkedTasks: [
          {
            id: 'task-private',
            title: 'Internal task',
            taskType: 'ISSUE_RESOLUTION',
            priority: 'NORMAL',
            status: 'COMPLETED',
            assigneeId: 'internal-worker',
            assignedAt: detail.reportedAt,
          },
        ],
      },
    })
    page(`${path}/${detail.id}`, role)
    const title = await screen.findByRole('heading', { level: 2, name: detail.title })
    expect(title.closest('section')).toHaveClass('card-soft')
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-2xl')
    for (const value of [
      'internal-reviewer',
      'internal-review-note',
      'internal-conclusion',
      'internal-closer',
    ]) {
      if (role === 'CUSTOMER') expect(screen.queryByText(value)).not.toBeInTheDocument()
      else expect(screen.getByText(value)).toBeInTheDocument()
    }
    if (role === 'CUSTOMER') {
      expect(
        screen.queryByText(/Internal task|internal-worker|task-private/),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Theo dõi xử lý sự cố' })).not.toBeInTheDocument()
    }
  },
)

test('API whitelists query fields and bounds pagination without actor parameters', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: {} })
  await listIssues({
    page: 20000,
    limit: 500,
    keyword: '.*',
    category: 'exact',
    actorId: 'evil',
    role: 'MANAGER',
    status: 'CLOSED',
    priority: 'HIGH',
  } as unknown as IssueQuery)
  expect(get).toHaveBeenLastCalledWith('/issues', {
    params: {
      page: 10000,
      limit: 100,
      keyword: '.*',
      category: 'exact',
      priority: 'HIGH',
      status: 'CLOSED',
    },
  })
  await listIssues({ page: 0, limit: Number.NaN })
  expect(get).toHaveBeenLastCalledWith('/issues', { params: { page: 1, limit: 20 } })
  await getIssue('a/b')
  expect(get).toHaveBeenLastCalledWith('/issues/a%2Fb')
})

test.each([403, 404, 500])('detail %s renders no foreign or server data', async (status) => {
  vi.spyOn(api, 'get').mockRejectedValue({
    isAxiosError: true,
    response: { status, data: { ...detail, guestEmail: 'private@example.com', message: 'secret' } },
  })
  page('/customer/issues/foreign')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    status === 403 ? 'không có quyền' : status === 404 ? 'Không tìm thấy' : 'Không thể tải',
  )
  expect(screen.queryByText(detail.title)).not.toBeInTheDocument()
  expect(screen.queryByText(/private@example.com|secret/)).not.toBeInTheDocument()
})

test('loading, empty and error retry states', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}))
  const loading = page('/customer/issues')
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải')
  loading.unmount()
  get
    .mockRejectedValueOnce(new Error('secret'))
    .mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 20 } })
  page('/customer/issues')
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải')
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Không có sự cố phù hợp.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
})

test('shared cache isolates users and roles and clears visible data on failed next identity', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const auth = { me: { ...ME, role: 'CUSTOMER' }, status: 'authenticated' } as AuthContextValue
  function Probe() {
    const result = useIssue(detail.id)
    return <p>{result.isSuccess ? result.data.title : result.isError ? 'denied' : 'loading'}</p>
  }
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValueOnce({ data: detail })
    .mockRejectedValue({ isAxiosError: true, response: { status: 404 } })
  const tree = (id: string, role: string) => (
    <QueryClientProvider client={client}>
      <AuthContext value={{ ...auth, me: { ...ME, id, role } }}>
        <MemoryRouter>
          <Probe />
        </MemoryRouter>
      </AuthContext>
    </QueryClientProvider>
  )
  const result = render(tree('one', 'CUSTOMER'))
  expect(await screen.findByText(detail.title)).toBeInTheDocument()
  result.rerender(tree('two', 'CUSTOMER'))
  expect(screen.queryByText(detail.title)).not.toBeInTheDocument()
  expect(await screen.findByText('denied')).toBeInTheDocument()
  result.rerender(tree('one', 'MANAGER'))
  expect(screen.queryByText(detail.title)).not.toBeInTheDocument()
  expect(await screen.findByText('denied')).toBeInTheDocument()
  expect(get).toHaveBeenCalledTimes(3)
  expect(issueKeys.list('one', 'CUSTOMER', { page: 1, limit: 20 })).not.toEqual(
    issueKeys.list('two', 'CUSTOMER', { page: 1, limit: 20 }),
  )
  expect(issueKeys.list('one', 'CUSTOMER', { page: 1, limit: 20 })).not.toEqual(
    issueKeys.list('one', 'MANAGER', { page: 1, limit: 20 }),
  )
})
