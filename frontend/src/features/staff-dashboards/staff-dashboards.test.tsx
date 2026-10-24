import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AxiosError, type AxiosResponse } from 'axios'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { AuthContext, useAuth } from '@/features/auth/auth-context'
import { UserMenu } from '@/features/auth/UserMenu'
import type { AssignedTask, TaskList, TaskStatus } from '@/features/tasks/api'
import { staffDashboardRoutes } from './routes'
import { DashboardReadError, readStaffDashboard } from './api'
import { staffDashboardKey } from './hooks'

vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...original, api: { get: vi.fn() } }
})

const get = vi.mocked(api.get)
const now = Date.parse('2026-10-23T12:00:00Z')
const servicePath = '/staff/service/dashboard'
const operationsPath = '/staff/operations/dashboard'
const base: AssignedTask = {
  id: 'one',
  title: 'Kiểm tra phòng',
  taskType: 'ROOM_CHECK',
  priority: 'HIGH',
  status: 'ASSIGNED',
  assignedAt: '2026-10-23T08:00:00Z',
  sourceType: 'ISSUE',
  sourceId: 'private-source',
  sourceSummary: null,
}

function paramsOf(value: unknown): { status: TaskStatus; page: number; limit: number } {
  if (
    !value ||
    typeof value !== 'object' ||
    !('status' in value) ||
    !('page' in value) ||
    !('limit' in value) ||
    typeof value.page !== 'number' ||
    typeof value.limit !== 'number' ||
    !['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(String(value.status))
  )
    throw new Error('Invalid task query')
  return { status: value.status as TaskStatus, page: value.page, limit: value.limit }
}

function respond(tasks: AssignedTask[] = [], completed = 0) {
  get.mockImplementation(async (url, config) => {
    expect(url).toBe('/tasks/me')
    expect(config?.signal).toBeInstanceOf(AbortSignal)
    const { status, page, limit } = config!.params as {
      status: TaskStatus
      page: number
      limit: number
    }
    expect(Object.keys(paramsOf(config?.params)).sort()).toEqual(['limit', 'page', 'status'])
    const items = tasks.filter((task) => task.status === status)
    return {
      data: {
        items: items.slice((page - 1) * limit, page * limit),
        total: status === 'COMPLETED' ? completed : items.length,
        page,
        limit,
      },
    }
  })
}

function dashboard(path = servicePath, role = 'SERVICE_STAFF', permissions: string[] = []) {
  return renderWithAuth([...staffDashboardRoutes, { path: '/login', element: <p>Đăng nhập</p> }], {
    path,
    auth: { status: 'authenticated', me: { ...ME, role, permissions } },
  })
}

beforeEach(() => {
  get.mockReset()
  vi.spyOn(Date, 'now').mockReturnValue(now)
})
afterEach(() => vi.restoreAllMocks())

it.each([
  [servicePath, 'SERVICE_STAFF', 'Bảng điều khiển dịch vụ'],
  [operationsPath, 'OPERATIONS_STAFF', 'Bảng điều khiển vận hành'],
])(
  'renders dedicated %s with exact server counts and existing links only',
  async (path, role, title) => {
    respond([base, { ...base, id: 'two', status: 'IN_PROGRESS' }], 1234)
    dashboard(path, role)
    expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('1.234')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem công việc được giao' })).toHaveAttribute(
      'href',
      '/staff/tasks',
    )
    expect(screen.getByRole('link', { name: 'Cập nhật hồ sơ' })).toHaveAttribute('href', '/profile')
    expect(screen.getAllByRole('link')).toHaveLength(role === 'SERVICE_STAFF' ? 5 : 4)
    expect(Boolean(screen.queryByRole('link', { name: 'Lịch sử thực hiện dịch vụ' }))).toBe(
      role === 'SERVICE_STAFF',
    )
    expect(
      get.mock.calls.filter(([, config]) => paramsOf(config?.params).limit === 1),
    ).toHaveLength(3)
    expect(screen.getAllByText('Đã giao')).toHaveLength(2)
    expect(screen.getAllByText('Đang thực hiện')).toHaveLength(2)
  },
)

it.each([servicePath, operationsPath])(
  'denies all other roles at %s even with task permission',
  async (path) => {
    const denied = path === servicePath ? 'OPERATIONS_STAFF' : 'SERVICE_STAFF'
    for (const role of [denied, 'CUSTOMER', 'MANAGER', 'RECEPTIONIST', 'CUSTOM_ROLE']) {
      const view = dashboard(path, role, ['task:execute'])
      expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument()
      view.unmount()
    }
    expect(get).not.toHaveBeenCalled()
  },
)

it('redirects anonymous users and waits for authentication without API reads', async () => {
  const loading = renderWithAuth(staffDashboardRoutes, {
    path: servicePath,
    auth: { status: 'loading' },
  })
  expect(screen.getByText('Đang tải…')).toBeInTheDocument()
  loading.unmount()
  renderWithAuth([...staffDashboardRoutes, { path: '/login', element: <p>Đăng nhập</p> }], {
    path: servicePath,
  })
  expect(await screen.findByText('Đăng nhập')).toBeInTheDocument()
  expect(get).not.toHaveBeenCalled()
})

it.each(['SERVICE_STAFF', 'OPERATIONS_STAFF', 'MANAGER', 'CUSTOMER', 'CUSTOM_ROLE'])(
  'menu isolates dashboard links for %s and preserves task permission',
  (role) => {
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { status: 'authenticated', me: { ...ME, role, permissions: ['task:execute'] } },
    })
    expect(screen.queryByRole('link', { name: 'Bảng điều khiển dịch vụ' }) !== null).toBe(
      role === 'SERVICE_STAFF',
    )
    expect(screen.queryByRole('link', { name: 'Bảng điều khiển vận hành' }) !== null).toBe(
      role === 'OPERATIONS_STAFF',
    )
    expect(screen.getByRole('link', { name: 'Công việc được giao' })).toHaveAttribute(
      'href',
      '/staff/tasks',
    )
  },
)

it('shows accessible loading then empty metrics, without pretending missing routes exist', async () => {
  let resolve!: (value: { data: TaskList }) => void
  get.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  dashboard()
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải bảng điều khiển')
  expect(screen.queryByRole('definition')).not.toBeInTheDocument()
  await act(async () => resolve({ data: { items: [], total: 0, page: 1, limit: 1 } }))
  expect(await screen.findByText('Bạn chưa có công việc đang hoạt động.')).toBeInTheDocument()
  expect(screen.getAllByRole('definition').map((el) => el.textContent)).toEqual([
    '0',
    '0',
    '0',
    '0',
    '0',
  ])
  expect(screen.getAllByRole('link')).toHaveLength(3)
  expect(screen.getByRole('link', { name: 'Lịch sử thực hiện dịch vụ' })).toHaveAttribute(
    'href',
    '/staff/service-history',
  )
})

it.each([403, 404])('shows API %s without automatic retry or stale metrics', async (status) => {
  get.mockRejectedValue(
    new AxiosError('Denied', undefined, undefined, undefined, {
      status,
      data: {},
    } as AxiosResponse),
  )
  dashboard()
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(get).toHaveBeenCalledTimes(3)
  expect(screen.queryByRole('definition')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeDisabled()
})

it('retries transient HTTP failures then permits explicit recovery', async () => {
  get.mockRejectedValue(new Error('Network unavailable'))
  const started = Date.now()
  dashboard()
  expect(await screen.findByRole('alert', {}, { timeout: 6000 })).toBeInTheDocument()
  expect(get).toHaveBeenCalledTimes(9)
  expect(Date.now()).toBe(started)
  respond()
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Bạn chưa có công việc đang hoạt động.')).toBeInTheDocument()
})

it('reads every active page before computing near due, overdue and deterministic top five', async () => {
  const tasks = Array.from({ length: 101 }, (_, i) => ({
    ...base,
    id: `task-${i}`,
    title: `Task ${i}`,
  }))
  tasks[100] = {
    ...base,
    id: 'last-page',
    title: 'Overdue last page',
    dueAt: new Date(now - 1).toISOString(),
  }
  tasks[0] = {
    ...base,
    id: 'boundary-now',
    title: 'Due now',
    dueAt: new Date(now).toISOString(),
    priority: 'LOW',
  }
  tasks[1] = {
    ...base,
    id: 'urgent',
    title: 'Urgent now',
    dueAt: new Date(now).toISOString(),
    priority: 'URGENT',
  }
  tasks[2] = {
    ...base,
    id: 'future-priority',
    title: 'Unknown now',
    dueAt: new Date(now).toISOString(),
    priority: 'FUTURE_PRIORITY',
  }
  tasks[3] = {
    ...base,
    id: '24-hours',
    title: '24 hours',
    dueAt: new Date(now + 86400000).toISOString(),
  }
  tasks[4] = {
    ...base,
    id: 'after',
    title: 'After window',
    dueAt: new Date(now + 86400001).toISOString(),
  }
  const progress: AssignedTask = {
    ...base,
    id: 'progress',
    title: 'Progress overdue',
    status: 'IN_PROGRESS',
    dueAt: new Date(now - 2).toISOString(),
  }
  respond(
    [
      ...tasks,
      progress,
      {
        ...base,
        id: 'completed-overdue',
        title: 'Completed excluded',
        status: 'COMPLETED',
        dueAt: new Date(now - 100).toISOString(),
      },
    ],
    999,
  )
  dashboard()
  await screen.findByText('Overdue last page')
  expect(screen.getAllByRole('definition').map((el) => el.textContent)).toEqual([
    '101',
    '1',
    '999',
    '4',
    '2',
  ])
  const ordered = within(screen.getByRole('list'))
    .getAllByRole('link')
    .map((el) => el.textContent)
  expect(ordered).toEqual([
    'Progress overdue',
    'Overdue last page',
    'Urgent now',
    'Due now',
    'Unknown now',
  ])
  expect(screen.getByText('Ưu tiên: FUTURE_PRIORITY')).toBeInTheDocument()
  expect(get).toHaveBeenCalledWith('/tasks/me', {
    params: { status: 'ASSIGNED', page: 2, limit: 100 },
    signal: expect.any(AbortSignal),
  })
})

it.each(['cap', 'changed', 'missing', 'duplicate', 'bad-page'])(
  'fails closed on %s instead of displaying partial statistics',
  async (kind) => {
    get.mockImplementation(async (_url, config) => {
      const { status, page, limit } = paramsOf(config?.params)
      const total = status === 'ASSIGNED' ? (kind === 'cap' ? 10001 : 2) : 0
      let items =
        status === 'ASSIGNED' ? [base, { ...base, id: kind === 'duplicate' ? base.id : 'two' }] : []
      if (kind === 'missing') items = []
      return {
        data: {
          items,
          total: limit === 100 && kind === 'changed' ? 3 : total,
          page: kind === 'bad-page' ? 2 : page,
          limit,
        },
      }
    })
    dashboard()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      kind === 'cap'
        ? 'Vượt giới hạn đọc 10.000'
        : kind === 'bad-page'
          ? 'Phản hồi công việc không hợp lệ'
          : 'Công việc',
    )
    expect(screen.queryByRole('definition')).not.toBeInTheDocument()
    expect(get.mock.calls.length).toBeLessThanOrEqual(4)
  },
)

it('cancels active-page reads when the route unmounts', async () => {
  let activeSignal: AbortSignal | undefined
  get.mockImplementation(async (_url, config) => {
    if (paramsOf(config?.params).limit === 100) {
      activeSignal = config!.signal as AbortSignal
      return new Promise(() => {})
    }
    return {
      data: {
        items: [],
        total: paramsOf(config?.params).status === 'ASSIGNED' ? 1 : 0,
        page: 1,
        limit: 1,
      },
    }
  })
  const view = dashboard()
  await waitFor(() => expect(activeSignal).toBeDefined())
  view.unmount()
  expect(activeSignal!.aborted).toBe(true)
})

it('checks an already aborted read before paging', async () => {
  respond([base])
  const controller = new AbortController()
  controller.abort()
  await expect(readStaffDashboard(controller.signal)).rejects.toThrow()
  expect(get).toHaveBeenCalledTimes(3)
})

it('isolates cached data on user switch and shares task invalidation prefix only for the owner', async () => {
  respond([base], 7)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const oldKey = staffDashboardKey('u1', 'SERVICE_STAFF')
  const otherKey = staffDashboardKey('u2', 'SERVICE_STAFF')
  client.setQueryData(otherKey, {
    counts: { ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 42 },
    active: [],
    readAt: now,
  })
  const seed = renderWithAuth([{ path: '/', element: <p>Seed</p> }])
  const auth = seed.auth
  seed.unmount()
  function Switcher() {
    const { me } = useAuth()
    return <p>{me?.id}</p>
  }
  function App() {
    const [id, setId] = useState('u1')
    const [router] = useState(() =>
      createMemoryRouter(staffDashboardRoutes, { initialEntries: [servicePath] }),
    )
    return (
      <QueryClientProvider client={client}>
        <AuthContext
          value={{ ...auth, status: 'authenticated', me: { ...ME, id, role: 'SERVICE_STAFF' } }}
        >
          <button onClick={() => setId('u2')}>Switch user</button>
          <Switcher />
          <RouterProvider router={router} />
        </AuthContext>
      </QueryClientProvider>
    )
  }
  render(<App />)
  await screen.findByText('7')
  respond([], 42)
  fireEvent.click(screen.getByRole('button', { name: 'Switch user' }))
  expect(screen.queryByText('7')).not.toBeInTheDocument()
  await screen.findByText('42')
  expect(client.getQueryData(oldKey)).toBeDefined()
  expect(client.getQueryData(otherKey)).toBeDefined()
  await client.invalidateQueries({ queryKey: ['assigned-tasks', 'u1'], refetchType: 'none' })
  expect(client.getQueryState(oldKey)?.isInvalidated).toBe(true)
  expect(client.getQueryState(otherKey)?.isInvalidated).toBe(false)
})

it('375px jsdom smoke uses mobile-first wrapping cards and accessible labels (not visual browser QA)', async () => {
  const original = window.innerWidth
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
  respond([{ ...base, title: 'Dài'.repeat(100) }])
  dashboard()
  await screen.findByText('Dài'.repeat(100))
  expect(screen.getByRole('list')).toBeInTheDocument()
  expect(screen.getByLabelText('Thống kê công việc của bạn')).toHaveClass(
    'grid-cols-1',
    'sm:grid-cols-2',
  )
  expect(screen.getByRole('navigation', { name: 'Thao tác nhân viên' })).toHaveClass('flex-wrap')
  expect(screen.getByRole('link', { name: 'Xem công việc được giao' })).toHaveClass(
    'focus-visible:outline-2',
  )
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: original })
})

it('exposes a non-retryable consistency error type', () => {
  expect(new DashboardReadError('partial')).toBeInstanceOf(Error)
})
