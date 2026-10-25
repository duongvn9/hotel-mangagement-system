import { useEffect } from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { AssignedTaskDetailPage } from './pages/AssignedTaskDetailPage'
import { AxiosError, type AxiosResponse } from 'axios'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { api } from '@/lib/api-client'
import { taskRoutes } from './routes'
import type { AssignedTask, TaskList } from './api'

vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...original, api: { get: vi.fn(), patch: vi.fn() } }
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
const patch = vi.mocked(api.patch)

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
  patch.mockReset()
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

it.each(['SERVICE_STAFF', 'OPERATIONS_STAFF'])(
  'guides %s to their own task detail to update progress',
  async (role) => {
    get.mockResolvedValue({ data: list })
    renderTasks('/staff/tasks', role)
    expect(await screen.findByRole('link', { name: task.title })).toHaveAttribute(
      'href',
      '/staff/tasks/task-1',
    )
    expect(
      screen.getByText(
        'Danh sách công việc được giao cho bạn. Mở chi tiết công việc của bạn để cập nhật tiến độ.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Chỉ xem|không thay đổi tiến độ/i)).not.toBeInTheDocument()
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

it('starts only after detail loads, prevents double submission and renders authoritative progress', async () => {
  let resolve!: (value: { data: AssignedTask }) => void
  get.mockResolvedValueOnce({ data: task })
  patch.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  renderTasks('/staff/tasks/task-1')
  const start = await screen.findByRole('button', { name: 'Bắt đầu công việc' })
  fireEvent.click(start)
  fireEvent.click(start)
  await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
  expect(patch).toHaveBeenCalledWith('/tasks/task-1/progress', { status: 'IN_PROGRESS' })
  expect(start).toBeDisabled()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  const started: AssignedTask = { ...task, status: 'IN_PROGRESS' }
  get.mockResolvedValue({ data: started })
  await act(async () => resolve({ data: started }))
  expect(await screen.findByRole('textbox')).toBeInTheDocument()
  expect(await screen.findByText('Đã cập nhật tiến độ công việc.')).toBeInTheDocument()
  expect(get).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('button', { name: 'Bắt đầu công việc' })).not.toBeInTheDocument()
})

it.each(['', '   ', 'a'.repeat(2001)])(
  'validates required and maximum completion result (%#. case)',
  async (value) => {
    get.mockResolvedValue({ data: { ...task, status: 'IN_PROGRESS' } })
    renderTasks('/staff/tasks/task-1')
    const input = await screen.findByRole('textbox')
    fireEvent.change(input, { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành công việc' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('từ 1 đến 2000 ký tự')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(patch).not.toHaveBeenCalled()
  },
)

it('completes with trimmed 2000-character result and becomes read-only without replay', async () => {
  const result = 'a'.repeat(2000)
  const completed: AssignedTask = {
    ...task,
    status: 'COMPLETED',
    workResult: result,
    completedAt: '2026-10-23T09:00:00Z',
  }
  get
    .mockResolvedValueOnce({ data: { ...task, status: 'IN_PROGRESS' } })
    .mockResolvedValue({ data: completed })
  patch.mockResolvedValue({ data: completed })
  renderTasks('/staff/tasks/task-1')
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: `  ${result}  ` } })
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành công việc' }))
  expect(await screen.findByText('Đã cập nhật tiến độ công việc.')).toBeInTheDocument()
  expect(patch).toHaveBeenCalledExactlyOnceWith('/tasks/task-1/progress', {
    status: 'COMPLETED',
    workResult: result,
  })
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByText(result)).toBeInTheDocument()
  expect(get).toHaveBeenCalledTimes(2)
})

it.each([400, 403, 404, 409, 500])(
  'handles update %s without automatic mutation retry',
  async (status) => {
    get
      .mockResolvedValueOnce({ data: task })
      .mockResolvedValue({ data: { ...task, status: 'COMPLETED', workResult: 'Đã xử lý' } })
    patch.mockRejectedValue(
      new AxiosError('Rejected', undefined, undefined, undefined, {
        status,
        data: {},
      } as AxiosResponse),
    )
    renderTasks('/staff/tasks/task-1')
    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu công việc' }))
    const messages: Record<number, string> = {
      400: 'Dữ liệu cập nhật không hợp lệ',
      403: 'Bạn không có quyền',
      404: 'Không tìm thấy công việc',
      409: 'Trạng thái công việc đã thay đổi',
      500: 'Không thể cập nhật công việc',
    }
    expect(await screen.findByRole('alert')).toHaveTextContent(messages[status]!)
    expect(patch).toHaveBeenCalledTimes(1)
    if (status === 409) {
      expect(get).toHaveBeenCalledTimes(2)
      expect(await screen.findByText('Đã xử lý')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    } else {
      expect(get).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Bắt đầu công việc' })).toHaveProperty(
        'disabled',
        status === 403 || status === 404,
      )
    }
  },
)

it('disables completion input and prevents duplicate submissions while pending', async () => {
  let resolve!: (value: { data: AssignedTask }) => void
  get.mockResolvedValue({ data: { ...task, status: 'IN_PROGRESS' } })
  patch.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  renderTasks('/staff/tasks/task-1')
  const input = await screen.findByRole('textbox')
  fireEvent.change(input, { target: { value: 'Đã xử lý' } })
  const button = screen.getByRole('button', { name: 'Hoàn thành công việc' })
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
  expect(input).toBeDisabled()
  expect(button).toBeDisabled()
  expect(screen.getByText('Đang thực hiện')).toBeInTheDocument()
  const completed: AssignedTask = { ...task, status: 'COMPLETED', workResult: 'Đã xử lý' }
  get.mockResolvedValue({ data: completed })
  await act(async () => resolve({ data: completed }))
  expect(await screen.findByText('Đã cập nhật tiến độ công việc.')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('keeps result after a completion error and allows explicit retry', async () => {
  const started = { ...task, status: 'IN_PROGRESS' }
  get.mockResolvedValue({ data: started })
  patch.mockRejectedValueOnce(
    new AxiosError('Invalid', undefined, undefined, undefined, {
      status: 400,
      data: {},
    } as AxiosResponse),
  )
  renderTasks('/staff/tasks/task-1')
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: ' Đã sửa ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành công việc' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('textbox')).toHaveValue(' Đã sửa ')
  const completed = { ...task, status: 'COMPLETED', workResult: 'Đã sửa' }
  get.mockResolvedValue({ data: completed })
  patch.mockResolvedValue({ data: completed })
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành công việc' }))
  await screen.findByText('Đã cập nhật tiến độ công việc.')
  expect(patch).toHaveBeenCalledTimes(2)
})

it('invalidates only the current user detail and lists after success', async () => {
  let client!: QueryClient
  function Detail() {
    const queryClient = useQueryClient()
    useEffect(() => {
      client = queryClient
    }, [queryClient])
    return <AssignedTaskDetailPage />
  }
  const started = { ...task, status: 'IN_PROGRESS' }
  get.mockResolvedValueOnce({ data: task }).mockResolvedValue({ data: started })
  patch.mockResolvedValue({ data: started })
  renderWithAuth([{ path: '/staff/tasks/:id', element: <Detail /> }], {
    path: '/staff/tasks/task-1',
    auth: { status: 'authenticated', me: { ...ME, role: 'SERVICE_STAFF' } },
  })
  const start = await screen.findByRole('button', { name: 'Bắt đầu công việc' })
  client.setQueryData(['assigned-tasks', ME.id, { page: 1 }], list)
  client.setQueryData(['assigned-tasks', ME.id, { status: 'ASSIGNED' }], list)
  client.setQueryData(['assigned-tasks', 'other', { page: 1 }], list)
  client.setQueryData(['assigned-task', 'other', task.id], task)
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  fireEvent.click(start)
  await screen.findByText('Đã cập nhật tiến độ công việc.')
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['assigned-task', ME.id, task.id],
    exact: true,
  })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['assigned-tasks', ME.id] })
  expect(client.getQueryState(['assigned-tasks', ME.id, { page: 1 }])?.isInvalidated).toBe(true)
  expect(
    client.getQueryState(['assigned-tasks', ME.id, { status: 'ASSIGNED' }])?.isInvalidated,
  ).toBe(true)
  expect(client.getQueryState(['assigned-tasks', 'other', { page: 1 }])?.isInvalidated).toBe(false)
  expect(client.getQueryState(['assigned-task', 'other', task.id])?.isInvalidated).toBe(false)
  expect(get).toHaveBeenCalledTimes(2)
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
