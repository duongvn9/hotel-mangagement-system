import { fireEvent, screen, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { api } from '@/lib/api-client'
import { taskRoutes } from './routes'
import type { AssignedTask, TaskList } from './api'

vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...original, api: { get: vi.fn() } }
})

const task: AssignedTask = {
  id: 'task-1',
  title: 'Kiểm tra điều hòa',
  taskType: 'ROOM_CHECK',
  priority: 'HIGH',
  status: 'ASSIGNED',
  assignedAt: '2026-10-23T08:00:00Z',
  sourceType: 'ISSUE',
  sourceId: 'private-source',
  sourceSummary: null,
}
const list: TaskList = { items: [task], total: 1, page: 1, limit: 20 }
const get = vi.mocked(api.get)

function renderTasks(path = '/staff/tasks', role = 'SERVICE_STAFF', permissions: string[] = []) {
  return renderWithAuth([...taskRoutes, { path: '/login', element: <p>Đăng nhập</p> }], {
    path,
    auth: { status: 'authenticated', me: { ...ME, role, permissions } },
  })
}

function rejectStatus(status: number) {
  get.mockRejectedValue(
    new AxiosError('Denied', undefined, undefined, undefined, {
      status,
      data: {},
    } as AxiosResponse),
  )
}

beforeEach(() => {
  get.mockReset()
})

it.each(['SERVICE_STAFF', 'OPERATIONS_STAFF', 'CUSTOM_ROLE'])(
  'allows %s using role OR permission',
  async (role) => {
    get.mockResolvedValue({ data: list })
    renderTasks('/staff/tasks', role, role === 'CUSTOM_ROLE' ? ['task:execute'] : [])
    expect(await screen.findByRole('link', { name: task.title })).toHaveAttribute(
      'href',
      '/staff/tasks/task-1',
    )
    expect(get).toHaveBeenCalledWith('/tasks/me', { params: { page: 1, limit: 20 } })
  },
)

it.each(['CUSTOM_ROLE', 'MANAGER', 'CUSTOMER', 'RECEPTIONIST'])(
  'denies unprivileged %s without fetching',
  async (role) => {
    renderTasks('/staff/tasks/task-1', role)
    expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  },
)

it('redirects anonymous users without fetching', async () => {
  renderWithAuth([...taskRoutes, { path: '/login', element: <p>Đăng nhập</p> }], {
    path: '/staff/tasks',
  })
  expect(await screen.findByText('Đăng nhập')).toBeInTheDocument()
  expect(get).not.toHaveBeenCalled()
})

it('waits for auth without fetching', () => {
  renderWithAuth(taskRoutes, { path: '/staff/tasks', auth: { status: 'loading' } })
  expect(screen.getByText('Đang tải…')).toBeInTheDocument()
  expect(get).not.toHaveBeenCalled()
})

it('shows loading then an empty list', async () => {
  let resolve!: (value: { data: TaskList }) => void
  get.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  renderTasks()
  expect(screen.getByText('Đang tải công việc…')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Áp dụng bộ lọc' })).toBeDisabled()
  resolve({ data: { ...list, items: [], total: 0 } })
  expect(await screen.findByText('Bạn chưa có công việc được giao.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
})

it('sends literal keyword, exact task type, status and paging; resets page on filters', async () => {
  get.mockImplementation(async (_url, config) => {
    const params = config?.params
    if (
      !params ||
      typeof params !== 'object' ||
      !('page' in params) ||
      typeof params.page !== 'number'
    ) {
      throw new Error('Expected task query parameters with a numeric page')
    }
    return { data: { ...list, total: 21, page: params.page } }
  })
  renderTasks()
  await screen.findByText(task.title)
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/tasks/me', { params: { page: 2, limit: 20 } }),
  )
  await screen.findByText('21 công việc · Trang 2/2')
  fireEvent.change(screen.getByLabelText('Tìm theo tiêu đề'), { target: { value: 'Điều.*' } })
  fireEvent.change(screen.getByLabelText('Loại công việc (chính xác)'), {
    target: { value: 'ROOM_CHECK' },
  })
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'IN_PROGRESS' } })
  get.mockResolvedValue({ data: { ...list, items: [], total: 0 } })
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }))
  expect(await screen.findByText('Không có công việc khớp bộ lọc.')).toBeInTheDocument()
  expect(get).toHaveBeenLastCalledWith('/tasks/me', {
    params: {
      page: 1,
      limit: 20,
      keyword: 'Điều.*',
      taskType: 'ROOM_CHECK',
      status: 'IN_PROGRESS',
    },
  })
})

it.each([403, 404])('hides detail on API %s without source links or retry', async (status) => {
  rejectStatus(status)
  renderTasks('/staff/tasks/other-owner')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    status === 403 ? 'Bạn không có quyền' : 'Không tìm thấy công việc',
  )
  expect(get).toHaveBeenCalledTimes(1)
  expect(get).toHaveBeenCalledWith('/tasks/other-owner')
  expect(screen.queryByText(task.title)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeDisabled()
  expect(screen.getAllByRole('link')).toHaveLength(1)
})

it('renders detail and trace-only missing source without mutations', async () => {
  get.mockResolvedValue({ data: { ...task, status: 'COMPLETED', workResult: 'Đã kiểm tra' } })
  renderTasks('/staff/tasks/task-1')
  expect(await screen.findByText(task.title)).toBeInTheDocument()
  expect(screen.getByText('Hoàn thành')).toBeInTheDocument()
  expect(screen.getByText('Đã kiểm tra')).toBeInTheDocument()
  expect(screen.getByText('private-source')).toBeInTheDocument()
  expect(screen.getByText(/Thông tin nguồn hiện không khả dụng/)).toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('shows a forbidden list error and disables retry', async () => {
  rejectStatus(403)
  renderTasks()
  expect(await screen.findByRole('alert')).toHaveTextContent('Bạn không có quyền')
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeDisabled()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

it('shows a request error and allows manual retry', async () => {
  rejectStatus(400)
  renderTasks()
  await screen.findByRole('alert')
  expect(screen.queryByText(task.title)).not.toBeInTheDocument()
  get.mockResolvedValue({ data: list })
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText(task.title)).toBeInTheDocument()
})

it.each([
  ['SERVICE_STAFF', [], true],
  ['OPERATIONS_STAFF', [], true],
  ['CUSTOM_ROLE', ['task:execute'], true],
  ['CUSTOM_ROLE', [], false],
  ['MANAGER', [], false],
] as [string, string[], boolean][])(
  'menu access matches route for %s %j',
  (role, permissions, allowed) => {
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { status: 'authenticated', me: { ...ME, role, permissions } },
    })
    const link = screen.queryByRole('link', { name: 'Công việc được giao' })
    if (allowed) expect(link).toHaveAttribute('href', '/staff/tasks')
    else expect(link).not.toBeInTheDocument()
  },
)
