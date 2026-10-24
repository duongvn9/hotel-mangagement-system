import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthContext } from '@/features/auth/auth-context'
import { ME } from '@/features/auth/test-utils'
import { api } from '@/lib/api-client'
import type { IssueDetail } from './api'
import { issueRoutes } from './routes'

const id = 'c'.repeat(24)
const staff = 'd'.repeat(24)
const initial: IssueDetail = {
  id,
  title: 'Sự cố thử nghiệm',
  category: 'Phòng',
  description: 'Mô tả',
  bookingId: 'a'.repeat(24),
  priority: 'NORMAL',
  status: 'PENDING_REVIEW',
  reportedAt: '2026-10-24T10:00:00Z',
  linkedTasks: [],
  linkedTasksAvailable: false,
}
const reviewed: IssueDetail = {
  ...initial,
  status: 'REVIEWED',
  needsStaffAction: true,
  handlingCategory: 'SERVICE',
}
let queryClient: QueryClient

async function settle() {
  for (let pass = 0; pass < 2 || queryClient.isFetching() || queryClient.isMutating(); pass++) {
    await act(async () => {
      await Promise.resolve()
      await new Promise<void>((resolve) => {
        const check = () => {
          if (queryClient.isFetching() === 0 && queryClient.isMutating() === 0) {
            unsubscribeQueries()
            unsubscribeMutations()
            resolve()
          }
        }
        const unsubscribeQueries = queryClient.getQueryCache().subscribe(check)
        const unsubscribeMutations = queryClient.getMutationCache().subscribe(check)
        check()
      })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

async function confirm() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await Promise.resolve()
  })
  await settle()
}

async function assigneeField() {
  await settle()
  return screen.getByLabelText('Nhân viên xử lý')
}

function setup(detail = initial, role = 'RECEPTIONIST') {
  const get = vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: String(url).endsWith('/assignees')
      ? {
          items: [
            { id: staff, displayName: 'Lan', role: 'SERVICE_STAFF' },
            { id: 'e'.repeat(24), displayName: 'Không phù hợp', role: 'OPERATIONS_STAFF' },
          ],
        }
      : detail,
  }))
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(issueRoutes, {
    initialEntries: [
      `/${role === 'CUSTOMER' ? 'customer' : role === 'MANAGER' ? 'manager' : 'staff'}/issues/${id}`,
    ],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext
        value={{
          status: 'authenticated',
          me: { ...ME, role },
          isDevMode: false,
          login: vi.fn(),
          loginAsDev: vi.fn(),
          register: vi.fn(),
          logout: vi.fn(),
          refresh: vi.fn(),
        }}
      >
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  )
  return get
}
beforeEach(() => vi.restoreAllMocks())

test.each(['MANAGER', 'CUSTOMER'])(
  '%s cannot review or assign or fetch assignees',
  async (role) => {
    const get = setup(reviewed, role)
    await screen.findByText(initial.title)
    expect(
      screen.queryByRole('button', { name: /Xem xét|Phân công|Thử lại phân công/ }),
    ).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(1)
  },
)

test('review validates, confirms explicitly and concludes without assignment or task creation', async () => {
  const get = setup()
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({
    data: {
      ...initial,
      status: 'CONCLUDED',
      handlingCategory: 'OPERATIONS',
      needsStaffAction: false,
    },
  })
  const post = vi.spyOn(api, 'post')
  await settle()
  fireEvent.click(screen.getByRole('button', { name: 'Xem xét' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng chọn')
  expect(patch).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Nhóm xử lý'), { target: { value: 'OPERATIONS' } })
  fireEvent.change(screen.getByLabelText('Ghi chú xem xét'), { target: { value: '  Kết luận  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Xem xét' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Kết luận, không tạo công việc')
  expect(patch).not.toHaveBeenCalled()
  get.mockResolvedValue({ data: { ...initial, status: 'CONCLUDED', needsStaffAction: false } })
  await confirm()
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith(`/issues/${id}/review`, {
      handlingCategory: 'OPERATIONS',
      priority: 'NORMAL',
      needsStaffAction: false,
      notes: 'Kết luận',
    }),
  )
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Phân công' })).not.toBeInTheDocument()
  expect(post).not.toHaveBeenCalled()
})

test('review then assignment sends selected API user and timezone-converted ISO only after confirmation', async () => {
  const get = setup()
  const patch = vi.spyOn(api, 'patch').mockImplementation(async () => {
    get.mockImplementation(async (url) => ({
      data: String(url).endsWith('/assignees')
        ? { items: [{ id: staff, displayName: 'Lan', role: 'SERVICE_STAFF' }] }
        : reviewed,
    }))
    return { data: reviewed }
  })
  const post = vi.spyOn(api, 'post').mockImplementation(async () => {
    get.mockResolvedValue({ data: { ...reviewed, status: 'ASSIGNED' } })
    return { data: { ...reviewed, status: 'ASSIGNED' } }
  })
  await settle()
  expect(screen.getByRole('button', { name: 'Xem xét' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Nhóm xử lý'), { target: { value: 'SERVICE' } })
  fireEvent.change(screen.getByLabelText('Ưu tiên xử lý'), { target: { value: 'HIGH' } })
  fireEvent.click(screen.getByLabelText('Cần nhân viên xử lý'))
  fireEvent.click(screen.getByRole('button', { name: 'Xem xét' }))
  await confirm()
  fireEvent.change(await assigneeField(), { target: { value: staff } })
  expect(patch).toHaveBeenCalledWith(`/issues/${id}/review`, {
    handlingCategory: 'SERVICE',
    priority: 'HIGH',
    needsStaffAction: true,
  })
  fireEvent.change(screen.getByLabelText('Thời hạn xử lý'), {
    target: { value: '2026-10-26T15:30' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Phân công' }))
  expect(post).not.toHaveBeenCalled()
  await confirm()
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(`/issues/${id}/assignment`, {
      assigneeId: staff,
      dueAt: new Date('2026-10-26T15:30').toISOString(),
    }),
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: /Phân công|Thử lại phân công/ }),
    ).not.toBeInTheDocument(),
  )
})

test('failed assignment refresh recovers saved intent rather than allowing a different selection', async () => {
  const get = setup(reviewed)
  const post = vi.spyOn(api, 'post').mockImplementation(async () => {
    get.mockResolvedValue({ data: { ...reviewed, status: 'ASSIGNING', assigneeId: staff } })
    throw { isAxiosError: true, response: { status: 409 } }
  })
  fireEvent.change(await assigneeField(), { target: { value: staff } })
  fireEvent.click(screen.getByRole('button', { name: 'Phân công' }))
  await confirm()
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại phân công' }))
  expect(screen.queryByLabelText('Nhân viên xử lý')).not.toBeInTheDocument()
  await confirm()
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect(post.mock.calls.map(([, input]) => input)).toEqual([
    { assigneeId: staff },
    { assigneeId: staff },
  ])
})

test('assignees filter incompatible roles and require a real selection', async () => {
  setup(reviewed)
  await assigneeField()
  expect(screen.getByRole('option', { name: 'Lan — Nhân viên dịch vụ' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: /Không phù hợp/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Phân công' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng chọn nhân viên')
})

test.each(['loading', 'empty', 'error'])(
  'assignee %s blocks assignment and error can retry',
  async (state) => {
    const get = setup(reviewed)
    get.mockImplementation(async (url) => {
      if (!String(url).endsWith('/assignees')) return { data: reviewed }
      if (state === 'loading') return new Promise(() => {})
      if (state === 'error') throw new Error('private server message')
      return { data: { items: [] } }
    })
    await screen.findByText(
      state === 'loading'
        ? 'Đang tải nhân viên…'
        : state === 'empty'
          ? 'Không có nhân viên phù hợp đang hoạt động.'
          : /Không thể tải nhân viên/,
    )
    expect(screen.getByRole('button', { name: 'Phân công' })).toBeDisabled()
    if (state === 'error') {
      get.mockResolvedValue({
        data: { items: [{ id: staff, displayName: 'Lan', role: 'SERVICE_STAFF' }] },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Tải lại nhân viên' }))
      expect(await assigneeField()).toBeInTheDocument()
    }
  },
)

test.each([400, 403, 404, 409, 500])(
  'assignment %s refreshes detail and never leaks backend messages',
  async (status) => {
    const get = setup(reviewed)
    const post = vi.spyOn(api, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status, data: { message: 'private server message' } },
    })
    fireEvent.change(await assigneeField(), { target: { value: staff } })
    fireEvent.click(screen.getByRole('button', { name: 'Phân công' }))
    await confirm()
    await screen.findByRole('alert')
    expect(screen.queryByText('private server message')).not.toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(get.mock.calls.filter(([url]) => url === `/issues/${id}`).length).toBeGreaterThan(1),
    )
  },
)

test('durable ASSIGNING retries exact saved intent, disables pending, and final ASSIGNED has no replay', async () => {
  const dueAt = '2026-10-26T08:30:00.000Z'
  const get = setup({ ...reviewed, status: 'ASSIGNING', assigneeId: staff, dueAt })
  let resolve!: (value: { data: IssueDetail }) => void
  const post = vi.spyOn(api, 'post').mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Thử lại phân công' }))
  expect(screen.queryByLabelText('Nhân viên xử lý')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Thời hạn xử lý')).not.toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(`/issues/${id}/assignment`, { assigneeId: staff, dueAt }),
  )
  expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  const assigned: IssueDetail = { ...reviewed, status: 'ASSIGNED', assigneeId: staff }
  get.mockResolvedValue({ data: assigned })
  await act(async () => {
    resolve({ data: assigned })
    await Promise.resolve()
  })
  await settle()
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Thử lại phân công' })).not.toBeInTheDocument(),
  )
})

test.each(['MANAGER', 'CUSTOMER'])(
  'linked summary privacy and no unauthorized task links for %s',
  async (role) => {
    setup(
      {
        ...reviewed,
        reviewNotes: 'Ghi chú nội bộ',
        linkedTasksAvailable: true,
        linkedTasks: [
          {
            id: 'task',
            title: 'Công việc nội bộ',
            taskType: 'ISSUE_RESOLUTION',
            priority: 'HIGH',
            status: 'COMPLETED',
            assigneeId: staff,
            assignedAt: initial.reportedAt,
            completedAt: initial.reportedAt,
            ...({ workResult: 'Bí mật' } as object),
          },
        ],
      },
      role,
    )
    await screen.findByText(initial.title)
    if (role === 'CUSTOMER') {
      expect(screen.queryByText('Công việc nội bộ')).not.toBeInTheDocument()
      expect(screen.queryByText('Ghi chú nội bộ')).not.toBeInTheDocument()
    } else expect(screen.getByText('Công việc nội bộ')).toBeInTheDocument()
    expect(screen.queryByText('Bí mật')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Công việc nội bộ/ })).not.toBeInTheDocument()
  },
)
