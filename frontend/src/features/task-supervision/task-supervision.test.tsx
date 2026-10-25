import taskContract from '../../../../backend/src/modules/tasks/task-contract.ts?raw'
import { act, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { focusManager } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { taskSupervisionRoutes } from './routes'
import { QUEUE_STATES, QUEUE_LABELS, SOURCE_LABELS, priorityLabel, queueDate } from './presentation'
import type { QueueSummary, QueueTask, QueueDetail } from './api'

const person = { id: 'ops1', fullName: 'Nhân viên A', role: 'OPERATIONS_STAFF' }
const other = { id: 'ops2', fullName: 'Nhân viên B', role: 'SERVICE_STAFF' }
const summary: QueueSummary = {
  counts: { assigned: 2, inProgress: 1, completed: 1, other: 0, total: 4 },
  overdue: 1,
  workload: [
    { assignee: person, assigned: 2, inProgress: 1, completed: 1, overdue: 1 },
    { assignee: other, assigned: 0, inProgress: 0, completed: 1, overdue: 0 },
  ],
  facets: {
    taskTypes: ['MAINTENANCE', 'CUSTOM TYPE'],
    priorities: ['NORMAL', 'HIGH', 'RUSH.*[x]'],
  },
  generatedAt: '2026-10-25T03:00:00Z',
}
const task: QueueTask = {
  id: 'task1',
  title: 'Kiểm tra điều hòa',
  taskType: 'MAINTENANCE',
  priority: 'HIGH',
  status: 'ASSIGNED',
  sourceType: 'MAINTENANCE',
  sourceId: 'report1',
  assignee: person,
  assignedAt: '2026-10-24T17:05:00Z',
  dueAt: '2026-10-25T01:00:00Z',
  completedAt: null,
  overdue: true,
}
const detail: QueueDetail = {
  ...task,
  status: 'COMPLETED',
  overdue: false,
  completedAt: '2026-10-25T03:00:00Z',
  workResult: 'Đã thay bộ lọc và kiểm tra an toàn',
  source: { sourceType: 'MAINTENANCE', sourceId: 'report1' },
  sourceSummary: {
    description: 'Điều hòa phát tiếng ồn',
    room: { roomNumber: '102' },
    equipment: { assetCode: 'AC-102', name: 'Điều hòa' },
    preventsSafeUse: true,
  },
}
const page = (items: QueueTask[] = [task], total = items.length) => ({
  data: { items, total, page: 1, limit: 10 },
})
const root = '/manager/task-queues'
function renderPage(path = root, role = 'MANAGER') {
  return renderWithAuth(
    [...taskSupervisionRoutes, { path: '/login', element: <p>Đăng nhập test</p> }],
    {
      path,
      auth: {
        me: { ...ME, role, permissions: ['task:execute', 'report:view'] },
        status: 'authenticated',
      },
    },
  )
}
function mockApi() {
  vi.mocked(api.get).mockImplementation(async (url) =>
    url === '/task-queues/summary'
      ? { data: summary }
      : url === '/task-queues/tasks'
        ? page()
        : { data: detail },
  )
}
describe('UC55 labels and Task contract', () => {
  it('keeps status/source labels aligned with the actual backend enums, without inventing a priority enum', () => {
    const contract = taskContract
    const values = (name: string) =>
      [
        ...contract
          .match(new RegExp(`export enum ${name} \\{([^}]+)\\}`, 's'))![1]
          .matchAll(/=\s*'([^']+)'/g),
      ].map((match) => match[1])
    expect(QUEUE_STATES).toEqual(values('TaskStatus'))
    expect(Object.keys(QUEUE_LABELS)).toEqual(values('TaskStatus'))
    expect(Object.keys(SOURCE_LABELS)).toEqual(values('TaskSourceType'))
  })
  it.each([
    ['LOW', 'Thấp'],
    ['NORMAL', 'Bình thường'],
    ['HIGH', 'Cao'],
    ['URGENT', 'Khẩn cấp'],
    ['RUSH.*[x]', 'RUSH.*[x]'],
    ['MEDIUM', 'MEDIUM'],
    ['high', 'high'],
    [null, '—'],
    [undefined, '—'],
    ['', '—'],
  ])('displays priority %s as %s', (value, label) => {
    expect(priorityLabel(value)).toBe(label)
  })
  it('formats UTC instants explicitly in Vietnam and tolerates absent times', () => {
    expect(queueDate('2026-10-24T17:05:00Z')).toBe('25/10/2026 00:05')
    expect(queueDate(null)).toBe('—')
  })
})
describe('UC55 Manager task supervision', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  beforeEach(() => {
    vi.spyOn(api, 'get')
    mockApi()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    focusManager.setFocused(undefined)
  })
  it('renders live queue counts, Vietnam dates, exact priority facets, workload and a real detail link', async () => {
    renderPage()
    await screen.findByRole('table', { name: 'Task trong hàng đợi' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('tablist', { name: 'Chọn hàng đợi' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('tab', { name: /Chờ\/Đã giao/ })).getByText('2'),
    ).toBeInTheDocument()
    expect(screen.getByText('Quá hạn: 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: task.title })).toHaveAttribute('href', root + '/task1')
    expect(screen.getByText('25/10/2026 00:05')).toBeInTheDocument()
    expect(screen.getByText('Quá hạn', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Cao', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cao (HIGH)' })).toHaveValue('HIGH')
    expect(screen.getByRole('option', { name: 'RUSH.*[x]' })).toHaveValue('RUSH.*[x]')
    expect(screen.getByText('Cập nhật lúc', { exact: false })).toHaveTextContent('10:00')
    expect(
      screen.getByRole('table', { name: 'Khối lượng công việc theo nhân viên' }),
    ).toBeInTheDocument()
  })
  it('changes queues by click and arrow/Home/End keys with roving focus and proper sort defaults', async () => {
    renderPage()
    await screen.findByRole('table', { name: 'Task trong hàng đợi' })
    const assigned = screen.getByRole('tab', { name: /Chờ\/Đã giao/ })
    assigned.focus()
    fireEvent.keyDown(assigned, { key: 'ArrowRight' })
    const progress = screen.getByRole('tab', { name: /Đang xử lý/ })
    expect(progress).toHaveFocus()
    expect(progress).toHaveAttribute('aria-selected', 'true')
    expect(assigned).toHaveAttribute('tabindex', '-1')
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/task-queues/tasks', {
        params: expect.objectContaining({
          status: 'IN_PROGRESS',
          sortBy: 'dueAt',
          sortOrder: 'asc',
        }),
      }),
    )
    fireEvent.keyDown(progress, { key: 'End' })
    expect(screen.getByRole('tab', { name: /Hoàn thành/ })).toHaveFocus()
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/task-queues/tasks', {
        params: expect.objectContaining({
          status: 'COMPLETED',
          sortBy: 'completedAt',
          sortOrder: 'desc',
        }),
      }),
    )
    await screen.findByRole('columnheader', { name: 'Hoàn thành lúc' })
    fireEvent.keyDown(screen.getByRole('tab', { name: /Hoàn thành/ }), { key: 'Home' })
    expect(assigned).toHaveFocus()
    fireEvent.click(screen.getByRole('tab', { name: /Hoàn thành/ }))
    expect(screen.getByRole('tab', { name: /Hoàn thành/ })).toHaveAttribute('aria-selected', 'true')
  })
  it('debounces title, sends shared filters to summary without status, and limits overdue to task rows', async () => {
    vi.mocked(api.get).mockImplementation(async (url, config) =>
      url === '/task-queues/summary'
        ? {
            data: {
              ...summary,
              counts: (config?.params as { priority?: string } | undefined)?.priority
                ? { ...summary.counts, assigned: 1, total: 3 }
                : summary.counts,
            },
          }
        : page([task], 25),
    )
    renderPage()
    await screen.findByRole('table', { name: 'Task trong hàng đợi' })
    expect(api.get).toHaveBeenCalledTimes(2)
    fireEvent.change(screen.getByLabelText('Tìm tiêu đề'), { target: { value: ' [x].* ' } })
    expect(api.get).toHaveBeenCalledTimes(2)
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/task-queues/summary', {
        params: expect.objectContaining({ q: '[x].*' }),
      }),
    )
    fireEvent.change(screen.getByLabelText('Loại task'), { target: { value: 'MAINTENANCE' } })
    fireEvent.change(screen.getByLabelText('Nguồn task'), { target: { value: 'MAINTENANCE' } })
    fireEvent.change(screen.getByLabelText('Ưu tiên'), { target: { value: 'HIGH' } })
    await waitFor(() =>
      expect(
        within(screen.getByRole('tab', { name: /Chờ\/Đã giao/ })).getByText('1'),
      ).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByLabelText('Chỉ quá hạn trong bảng'))
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/task-queues/tasks', {
        params: expect.objectContaining({
          q: '[x].*',
          taskType: 'MAINTENANCE',
          sourceType: 'MAINTENANCE',
          priority: 'HIGH',
          overdue: true,
          status: 'ASSIGNED',
        }),
      }),
    )
    for (const [url, config] of vi.mocked(api.get).mock.calls)
      if (url === '/task-queues/summary') {
        expect(config?.params).not.toHaveProperty('status')
        expect(config?.params).not.toHaveProperty('overdue')
      }
    fireEvent.click(await screen.findByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/task-queues/tasks', {
        params: expect.objectContaining({ page: 2 }),
      }),
    )
    expect(screen.queryByRole('option', { name: 'Ưu tiên' })).not.toBeInTheDocument()
  })
  it('filters by staff from workload and refreshes both snapshots including generatedAt', async () => {
    let updated = false
    vi.mocked(api.get).mockImplementation(async (url) =>
      url === '/task-queues/summary'
        ? {
            data: updated
              ? {
                  ...summary,
                  generatedAt: '2026-10-25T04:00:00Z',
                  counts: { ...summary.counts, assigned: 5, total: 7 },
                }
              : summary,
          }
        : page(),
    )
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: person.fullName }))
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/task-queues/tasks', {
        params: expect.objectContaining({ assigneeId: 'ops1' }),
      }),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Làm mới' })).not.toBeDisabled())
    vi.mocked(api.get).mockClear()
    updated = true
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() =>
      expect(screen.getByText('Cập nhật lúc', { exact: false })).toHaveTextContent('11:00'),
    )
    expect(api.get).toHaveBeenCalledWith('/task-queues/summary', {
      params: expect.objectContaining({ assigneeId: 'ops1' }),
    })
    expect(api.get).toHaveBeenCalledWith('/task-queues/tasks', {
      params: expect.objectContaining({ assigneeId: 'ops1' }),
    })
    expect(
      within(screen.getByRole('tab', { name: /Chờ\/Đã giao/ })).getByText('5'),
    ).toBeInTheDocument()
    expect(screen.getByText('Cập nhật lúc', { exact: false })).toHaveAttribute(
      'aria-live',
      'polite',
    )
  })
  it('refetches on focus without using an interval', async () => {
    renderPage()
    await screen.findByRole('table', { name: 'Task trong hàng đợi' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Làm mới' })).not.toBeDisabled())
    vi.mocked(api.get).mockClear()
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/task-queues/summary', { params: expect.any(Object) }),
    )
    expect(api.get).toHaveBeenCalledWith('/task-queues/tasks', { params: expect.any(Object) })
  })
  it('shows loading states separately for the summary, table and workload', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Đang tải số liệu hàng đợi…')).toBeInTheDocument()
    expect(screen.getByText('Đang tải task…')).toBeInTheDocument()
    expect(screen.getByText('Đang tải khối lượng công việc…')).toBeInTheDocument()
  })
  it('keeps task rows usable when summary/workload fails, and supports retry in each block', async () => {
    let fail = true
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/task-queues/summary' && fail) throw new Error('Lỗi số liệu')
      return url === '/task-queues/summary' ? { data: summary } : page()
    })
    renderPage()
    await screen.findByRole('link', { name: task.title })
    const workload = screen.getByRole('region', { name: 'Khối lượng công việc' })
    expect(within(workload).getByRole('alert')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Số liệu hàng đợi' })).getByRole('alert'),
    ).toBeInTheDocument()
    fail = false
    fireEvent.click(within(workload).getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('button', { name: person.fullName })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('keeps summary and workload visible when the task list fails', async () => {
    let fail = true
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/task-queues/tasks' && fail) throw new Error('Lỗi bảng')
      return url === '/task-queues/summary' ? { data: summary } : page()
    })
    renderPage()
    await screen.findByRole('button', { name: person.fullName })
    const panel = screen.getByRole('tabpanel')
    await within(panel).findByRole('alert')
    expect(screen.getByText('Quá hạn: 1')).toBeInTheDocument()
    fail = false
    fireEvent.click(within(panel).getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('link', { name: task.title })
  })
  it.each([
    [root, 'Chưa có task nào.'],
    [root + '?q=missing', 'Không có task khớp bộ lọc.'],
  ])('distinguishes empty state at %s', async (path, label) => {
    vi.mocked(api.get).mockImplementation(async (url) =>
      url === '/task-queues/summary'
        ? {
            data: {
              ...summary,
              counts: { assigned: 0, inProgress: 0, completed: 0, other: 0, total: 0 },
              workload: [],
            },
          }
        : page([]),
    )
    renderPage(path)
    expect((await screen.findAllByText(label)).length).toBeGreaterThan(0)
  })
  it('distinguishes an empty selected queue from an empty system', async () => {
    vi.mocked(api.get).mockImplementation(async (url) =>
      url === '/task-queues/summary' ? { data: summary } : page([]),
    )
    renderPage()
    await screen.findByText('Hàng đợi này đang trống.')
    expect(screen.queryByText('Chưa có task nào.')).not.toBeInTheDocument()
  })
  it('opens a completed detail through a real link, then keeps queue and filters when returning', async () => {
    const { router } = renderPage(root + '?status=COMPLETED&priority=HIGH&q=kiểm&page=2')
    fireEvent.click(await screen.findByRole('link', { name: task.title }))
    await screen.findByText(detail.workResult!)
    expect(screen.getByText('Nguồn bảo trì')).toBeInTheDocument()
    expect(screen.getByText('Phòng 102')).toBeInTheDocument()
    expect(screen.getByText('AC-102 — Điều hòa')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: /sửa|giao lại|hoàn thành|xóa/i }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Quay lại hàng đợi' }))
    await screen.findByRole('table', { name: 'Task trong hàng đợi' })
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('2')
    expect(screen.getByRole('tab', { name: /Hoàn thành/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Tìm tiêu đề')).toHaveValue('kiểm')
    expect(screen.getByLabelText('Ưu tiên')).toHaveValue('HIGH')
  })
  it('handles missing assignees, raw priorities and missing priorities in rows', async () => {
    vi.mocked(api.get).mockImplementation(async (url) =>
      url === '/task-queues/summary'
        ? { data: summary }
        : page([
            { ...task, id: 'raw', title: 'Raw priority', priority: 'RUSH.*[x]', assignee: null },
            { ...task, id: 'missing', title: 'Missing priority', priority: null },
          ]),
    )
    renderPage()
    await screen.findByText('RUSH.*[x]', { selector: 'span' })
    expect(screen.getByText('Không còn nhân viên')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
  it('uses reference-only details for ISSUE and displays current fields without write controls', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...detail,
        sourceType: 'ISSUE',
        source: { sourceType: 'ISSUE', sourceId: 'issue1' },
        sourceId: 'issue1',
        sourceSummary: null,
        priority: 'CUSTOM',
        assignee: null,
      },
    })
    renderPage(root + '/task1')
    await screen.findByText('CUSTOM', { selector: 'span' })
    expect(screen.getByText('Sự cố · issue1')).toBeInTheDocument()
    expect(screen.queryByText('Nguồn bảo trì')).not.toBeInTheDocument()
    expect(screen.getByText('Không còn nhân viên')).toBeInTheDocument()
  })
  it('shows a 404 with a return link and permits retrying other detail errors', async () => {
    vi.mocked(api.get).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { message: 'Missing' } },
    })
    const first = renderPage(root + '/missing')
    await screen.findByText('Không tìm thấy task')
    expect(screen.getByRole('link', { name: 'Quay lại hàng đợi' })).toHaveAttribute('href', root)
    first.unmount()
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('Network'))
      .mockResolvedValue({ data: detail })
    renderPage(root + '/task1')
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByText(detail.workResult!)
  })
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'blocks %s even with execution/report permission on both routes',
    async (role) => {
      const first = renderPage(root, role)
      await screen.findByText('Không có quyền truy cập')
      first.unmount()
      renderPage(root + '/task1', role)
      await screen.findByText('Không có quyền truy cập')
      expect(api.get).not.toHaveBeenCalled()
    },
  )
  it('redirects anonymous visitors and exposes the Manager menu only to Manager', async () => {
    const first = renderWithAuth(
      [...taskSupervisionRoutes, { path: '/login', element: <p>Đăng nhập test</p> }],
      { path: root },
    )
    await screen.findByText('Đăng nhập test')
    expect(api.get).not.toHaveBeenCalled()
    first.unmount()
    const manager = renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: ME, status: 'authenticated' },
    })
    expect(screen.getByRole('link', { name: 'Hàng đợi task' })).toHaveAttribute('href', root)
    manager.unmount()
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: { ...ME, role: 'OPERATIONS_STAFF' }, status: 'authenticated' },
    })
    expect(screen.queryByRole('link', { name: 'Hàng đợi task' })).not.toBeInTheDocument()
  })
})
