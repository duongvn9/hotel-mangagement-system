import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthContext } from '@/features/auth/auth-context'
import { ME } from '@/features/auth/test-utils'
import { api } from '@/lib/api-client'
import { canCloseIssue, closeIssue, normalizeIssueQuery, type IssueDetail } from './api'
import { IssueClosure } from './IssueClosure'
import { issueRoutes } from './routes'

const id = 'c'.repeat(24)
const concluded: IssueDetail = {
  id,
  title: 'Sự cố đóng',
  category: 'Phòng',
  description: 'Mô tả',
  bookingId: 'a'.repeat(24),
  status: 'CONCLUDED',
  priority: 'NORMAL',
  needsStaffAction: false,
  handlingCategory: 'SERVICE',
  reportedAt: '2026-10-24T09:00:00Z',
  reviewedAt: '2026-10-24T10:00:00Z',
  reviewedBy: 'd'.repeat(24),
  concludedAt: '2026-10-24T10:00:00Z',
  linkedTasks: [],
  linkedTasksAvailable: false,
}
const completed: IssueDetail = {
  ...concluded,
  status: 'ASSIGNED',
  needsStaffAction: true,
  concludedAt: undefined,
  linkedTasksAvailable: true,
  linkedTasks: [
    {
      id: 'e'.repeat(24),
      title: 'Xử lý',
      taskType: 'ISSUE_RESOLUTION',
      priority: 'NORMAL',
      status: 'COMPLETED',
      assigneeId: 'f'.repeat(24),
      assignedAt: '2026-10-24T10:00:00Z',
      completedAt: '2026-10-24T11:00:00Z',
    },
  ],
}
const closed: IssueDetail = {
  ...concluded,
  status: 'CLOSED',
  closedAt: '2026-10-24T12:00:00Z',
  closedBy: 'b'.repeat(24),
  closureConclusion: '<b>Kết luận nội bộ</b>',
}
let client: QueryClient

async function settle() {
  for (let pass = 0; pass < 2 || client.isFetching() || client.isMutating(); pass++) {
    await act(async () => {
      await Promise.resolve()
      await new Promise<void>((resolve) => {
        const check = () => {
          if (client.isFetching() === 0 && client.isMutating() === 0) {
            unsubscribeQueries()
            unsubscribeMutations()
            resolve()
          }
        }
        const unsubscribeQueries = client.getQueryCache().subscribe(check)
        const unsubscribeMutations = client.getMutationCache().subscribe(check)
        check()
      })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

function setup(detail = concluded, role = 'RECEPTIONIST', direct = false) {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: detail })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(issueRoutes, {
    initialEntries: [
      `/${role === 'CUSTOMER' ? 'customer' : role === 'MANAGER' ? 'manager' : 'staff'}/issues/${id}`,
    ],
  })
  render(
    <QueryClientProvider client={client}>
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
        {direct ? <IssueClosure issue={detail} /> : <RouterProvider router={router} />}
      </AuthContext>
    </QueryClientProvider>,
  )
  return get
}

function open(value = '  Đã xử lý  ') {
  fireEvent.click(screen.getByRole('button', { name: 'Đóng sự cố' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Kết luận đóng sự cố*' }), {
    target: { value },
  })
}
async function confirm() {
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng' }))
  await settle()
}
beforeEach(() => vi.restoreAllMocks())

test.each([
  ['RECEPTIONIST', concluded],
  ['MANAGER', concluded],
  ['RECEPTIONIST', completed],
  ['MANAGER', completed],
] as const)(
  '%s closes persisted %s with confirmation and authoritative refresh',
  async (role, detail) => {
    const get = setup(detail, role)
    const post = vi.spyOn(api, 'post').mockImplementation(async () => {
      get.mockResolvedValue({ data: closed })
      return { data: closed }
    })
    await settle()
    expect(screen.queryByRole('button', { name: /Xem xét|Phân công/ })).not.toBeInTheDocument()
    open()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Kết luận đóng sự cố*' })).toHaveAttribute(
      'maxlength',
      '2000',
    )
    expect(post).not.toHaveBeenCalled()
    await confirm()
    expect(post).toHaveBeenCalledExactlyOnceWith(`/issues/${id}/close`, { conclusion: 'Đã xử lý' })
    expect(get).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Đã đóng')).toBeInTheDocument()
    expect(screen.getByText(closed.closureConclusion!)).toBeInTheDocument()
    expect(screen.getByText(closed.closedBy!)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đóng sự cố' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  },
)

test.each([
  { ...concluded, reviewedAt: undefined },
  { ...concluded, reviewedBy: undefined },
  { ...concluded, concludedAt: undefined },
  { ...concluded, needsStaffAction: true },
  { ...completed, linkedTasksAvailable: false },
  { ...completed, linkedTasks: [] },
  { ...completed, linkedTasks: [{ ...completed.linkedTasks[0], status: 'IN_PROGRESS' }] },
  { ...completed, linkedTasks: [{ ...completed.linkedTasks[0], completedAt: undefined }] },
  { ...concluded, status: 'REVIEWED' as const },
  closed,
])('incomplete or closed snapshot cannot close: %s', async (detail) => {
  setup(detail, 'MANAGER')
  await settle()
  expect(canCloseIssue(detail)).toBe(false)
  expect(screen.queryByRole('button', { name: 'Đóng sự cố' })).not.toBeInTheDocument()
})

test.each(['CUSTOMER', 'SERVICE_STAFF', 'OPERATIONS_STAFF', 'CUSTOM_RECEPTIONIST'])(
  '%s has no close action even with permissions',
  async (role) => {
    setup(concluded, role, true)
    await settle()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  },
)

test('validates blank/oversize, cancellation clears error and sends no request', async () => {
  setup()
  const post = vi.spyOn(api, 'post')
  await settle()
  open('   ')
  await confirm()
  expect(screen.getByRole('alert')).toHaveTextContent('từ 1 đến 2000')
  fireEvent.change(screen.getByRole('textbox', { name: 'Kết luận đóng sự cố*' }), {
    target: { value: 'x'.repeat(2001) },
  })
  await confirm()
  expect(screen.getByRole('alert')).toHaveTextContent('từ 1 đến 2000')
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(post).not.toHaveBeenCalled()
})

test('pending locks confirmation, cancel and input; synchronous double click posts once, no optimistic closure', async () => {
  const get = setup()
  let resolve!: (value: { data: IssueDetail }) => void
  const post = vi.spyOn(api, 'post').mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  await settle()
  open()
  const button = screen.getByRole('button', { name: 'Xác nhận đóng' })
  await act(async () => {
    fireEvent.click(button)
    fireEvent.click(button)
    await Promise.resolve()
  })
  expect(post).toHaveBeenCalledTimes(1)
  expect(button).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled()
  expect(screen.getByRole('textbox', { name: 'Kết luận đóng sự cố*' })).toBeDisabled()
  expect(screen.queryByText('Đã đóng')).not.toBeInTheDocument()
  get.mockResolvedValue({ data: closed })
  await act(async () => {
    resolve({ data: closed })
    await Promise.resolve()
  })
  await settle()
  expect(screen.getByText('Đã đóng')).toBeInTheDocument()
})

test.each([
  [400, 'Kết luận không hợp lệ'],
  [403, 'không có quyền đóng'],
  [404, 'Không tìm thấy sự cố'],
  [409, 'chưa đủ điều kiện đóng'],
  [500, 'Không thể xác nhận kết quả'],
  [undefined, 'Không thể xác nhận kết quả'],
])('HTTP %s reports close-specific error and refreshes stale snapshot', async (status, message) => {
  const get = setup()
  vi.spyOn(api, 'post').mockImplementation(async () => {
    get.mockResolvedValue({
      data: { ...completed, linkedTasks: [{ ...completed.linkedTasks[0], status: 'IN_PROGRESS' }] },
    })
    throw { isAxiosError: true, response: status ? { status } : undefined }
  })
  await settle()
  open()
  await confirm()
  expect(screen.getByRole('alert')).toHaveTextContent(message!)
  expect(get).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đóng sự cố' })).not.toBeInTheDocument()
  expect(screen.queryByText('Đã đóng')).not.toBeInTheDocument()
})

test('customer sees closed status/time but audit and linked task details remain withheld even if present', async () => {
  setup({ ...closed, linkedTasks: completed.linkedTasks, linkedTasksAvailable: true }, 'CUSTOMER')
  await settle()
  expect(screen.getByText('Đã đóng')).toBeInTheDocument()
  expect(screen.getByText('Ngày đóng')).toBeInTheDocument()
  expect(screen.queryByText(closed.closedBy!)).not.toBeInTheDocument()
  expect(screen.queryByText(closed.closureConclusion!)).not.toBeInTheDocument()
  expect(screen.queryByText('Xử lý')).not.toBeInTheDocument()
  expect(screen.getByText(/Chưa thể cung cấp thông tin công việc/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đóng sự cố' })).not.toBeInTheDocument()
  expect(screen.queryAllByRole('link')).toHaveLength(1)
})

test('CLOSED is an accepted list filter and close API only sends trimmed conclusion', async () => {
  expect(normalizeIssueQuery({ page: 1, limit: 20, status: 'CLOSED' }).status).toBe('CLOSED')
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: closed })
  await closeIssue(id, {
    conclusion: ' x ',
    actor: 'forged',
    statusTask: 'COMPLETED',
  } as Parameters<typeof closeIssue>[1])
  expect(post).toHaveBeenCalledExactlyOnceWith(`/issues/${id}/close`, { conclusion: 'x' })
  await expect(closeIssue(id, { conclusion: ' ' })).rejects.toThrow()
  await expect(closeIssue(id, { conclusion: 'x'.repeat(2001) })).rejects.toThrow()
  expect(post).toHaveBeenCalledTimes(1)
})
