import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { AxiosError, type AxiosResponse } from 'axios'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { AssignedTaskDetailPage } from '@/features/tasks/pages/AssignedTaskDetailPage'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { api } from '@/lib/api-client'
import { taskRoutes } from '@/features/tasks/routes'
import type { AssignedTask } from '@/features/tasks/api'
import {
  normalizeServiceIssue,
  reportServiceIssue,
  validateServiceIssue,
} from './service-issue-api'

vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...original, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }
})

const task: AssignedTask = {
  id: 'task-1',
  title: 'Thực hiện dịch vụ',
  taskType: 'SERVICE_ORDER_EXECUTION',
  sourceType: 'SERVICE_ORDER',
  sourceId: 'order-1',
  sourceSummary: null,
  status: 'IN_PROGRESS',
  priority: 'NORMAL',
  assignedAt: '2026-10-23T08:00:00Z',
}
const context = {
  taskId: task.id,
  taskTitle: task.title,
  taskStatus: 'IN_PROGRESS',
  serviceOrderId: 'order-1',
  service: { id: 'service-1', name: 'Giặt là', unit: 'Lần' },
  booking: { id: 'booking-1', code: 'BK01' },
  customer: { email: 'private@example.com', phone: '0900000000' },
}
const payload = { title: 'Sự cố', category: 'Khác', description: 'Máy hỏng' }
const receipt = {
  ...payload,
  id: 'issue-1',
  status: 'PENDING_REVIEW',
  priority: 'NORMAL',
  reportedAt: '2026-10-23T08:00:00Z',
  bookingId: 'booking-1',
  serviceOrderId: 'order-1',
  sourceTaskId: task.id,
  serviceId: 'service-1',
}
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const patch = vi.mocked(api.patch)
const failure = (status?: number) =>
  new AxiosError(
    'Failure',
    undefined,
    undefined,
    undefined,
    status ? ({ status, data: {} } as AxiosResponse) : undefined,
  )

function renderTask(role = 'SERVICE_STAFF', overrides: Partial<AssignedTask> = {}) {
  get.mockImplementation(async (url) => ({
    data: String(url).endsWith('/context') ? context : { ...task, ...overrides },
  }))
  return renderWithAuth(taskRoutes, {
    path: '/staff/tasks/task-1',
    auth: { status: 'authenticated', me: { ...ME, role, permissions: ['task:execute'] } },
  })
}
async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Báo sự cố dịch vụ' }))
  await screen.findByText('Giặt là')
  await waitFor(() => expect(screen.getByLabelText(/Tiêu đề sự cố dịch vụ/)).toBeEnabled())
}
function fill(value = payload) {
  fireEvent.change(screen.getByLabelText(/Tiêu đề sự cố dịch vụ/), {
    target: { value: value.title },
  })
  fireEvent.change(screen.getByLabelText(/Nhóm sự cố dịch vụ/), {
    target: { value: value.category },
  })
  fireEvent.change(screen.getByLabelText(/Mô tả sự cố dịch vụ/), {
    target: { value: value.description },
  })
}
function submit() {
  fireEvent.submit(screen.getByLabelText(/Tiêu đề sự cố dịch vụ/).closest('form')!)
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockReset()
  post.mockReset()
  patch.mockReset()
})

it.each(['OPERATIONS_STAFF', 'CUSTOM_ROLE'])(
  'does not offer UC34 to %s with task:execute but preserves UC38',
  async (role) => {
    renderTask(role)
    expect(await screen.findByRole('button', { name: 'Hoàn thành công việc' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Báo sự cố dịch vụ' })).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(1)
  },
)
it.each<Partial<AssignedTask>>([
  { sourceType: 'ISSUE' },
  { sourceType: 'MAINTENANCE' },
  { taskType: 'CUSTOM' },
  { status: 'ASSIGNED' },
  { status: 'COMPLETED' },
])('hides report for ineligible actual task %j', async (overrides) => {
  renderTask('SERVICE_STAFF', overrides)
  await screen.findByRole('heading', { name: task.title })
  expect(screen.queryByRole('button', { name: 'Báo sự cố dịch vụ' })).not.toBeInTheDocument()
  expect(get).toHaveBeenCalledTimes(1)
})
it('requires successful server context and renders only safe readonly fields', async () => {
  renderTask()
  get.mockImplementation(async (url) => {
    if (String(url).endsWith('/context')) throw failure(404)
    return { data: task }
  })
  fireEvent.click(await screen.findByRole('button', { name: 'Báo sự cố dịch vụ' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy')
  expect(screen.getByRole('button', { name: 'Gửi báo cáo sự cố dịch vụ' })).toBeDisabled()
  submit()
  expect(post).not.toHaveBeenCalled()
  get.mockImplementation(async (url) => ({
    data: String(url).endsWith('/context') ? context : task,
  }))
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại ngữ cảnh dịch vụ' }))
  await screen.findByText('BK01')
  expect(screen.getByText('Giặt là').tagName).toBe('DD')
  expect(screen.queryByDisplayValue('order-1')).not.toBeInTheDocument()
  expect(screen.queryByText('private@example.com')).not.toBeInTheDocument()
  expect(screen.queryByText('0900000000')).not.toBeInTheDocument()
})
it.each(['title', 'category', 'description'] as const)(
  'validates blank and excessive %s including tampered input',
  async (field) => {
    renderTask()
    await openForm()
    for (const value of [
      '   ',
      'x'.repeat({ title: 200, category: 100, description: 5000 }[field] + 1),
    ]) {
      fill({ ...payload, [field]: value })
      submit()
      expect(post).not.toHaveBeenCalled()
      expect(screen.getByText(/Vui lòng nhập từ 1 đến/)).toBeInTheDocument()
    }
  },
)
it('normalizes boundary values and explicitly strips injected body fields', async () => {
  const input = {
    title: ` ${'a'.repeat(200)} `,
    category: ` ${'b'.repeat(100)} `,
    description: ` ${'c'.repeat(5000)} `,
    sourceTaskId: 'forged',
    customer: 'forged',
    status: 'COMPLETED',
    price: 999,
    assignee: 'forged',
  }
  expect(validateServiceIssue(input)).toEqual({})
  post.mockResolvedValue({ data: receipt })
  await reportServiceIssue('task/1', input, 'uuid')
  expect(post).toHaveBeenCalledExactlyOnceWith('/issues/service-tasks/task%2F1', {
    ...normalizeServiceIssue(input),
    requestId: 'uuid',
  })
  expect(Object.keys(post.mock.calls[0][1] as object).sort()).toEqual([
    'category',
    'description',
    'requestId',
    'title',
  ])
})
it('blocks pending duplicates, keeps receipt and pending request across task completion, never patches progress', async () => {
  let resolve!: (value: { data: typeof receipt }) => void
  post.mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  let client!: QueryClient
  function Detail() {
    const queryClient = useQueryClient()
    useEffect(() => {
      client = queryClient
    }, [queryClient])
    return <AssignedTaskDetailPage />
  }
  get.mockImplementation(async (url) => ({
    data: String(url).endsWith('/context') ? context : task,
  }))
  renderWithAuth([{ path: '/staff/tasks/:id', element: <Detail /> }], {
    path: '/staff/tasks/task-1',
    auth: { status: 'authenticated', me: { ...ME, role: 'SERVICE_STAFF' } },
  })
  await openForm()
  fill()
  submit()
  submit()
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
  expect(screen.getByLabelText(/Tiêu đề sự cố dịch vụ/)).toBeDisabled()
  get.mockImplementation(async (url) => ({
    data: String(url).endsWith('/context') ? context : { ...task, status: 'COMPLETED' },
  }))
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['assigned-task'] })
  })
  expect(screen.queryByRole('button', { name: 'Báo sự cố dịch vụ' })).not.toBeInTheDocument()
  await act(async () => resolve({ data: receipt }))
  expect(await screen.findByText('Đã tiếp nhận báo cáo — Chờ xem xét')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Báo sự cố khác' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /sự cố/ })).not.toBeInTheDocument()
  expect(patch).not.toHaveBeenCalled()
})
it.each([undefined, 503])(
  'retains normalized retry UUID through context refresh after %s; explicit new report gets new UUID',
  async (status) => {
    post.mockRejectedValueOnce(failure(status)).mockResolvedValue({ data: receipt })
    renderTask()
    await openForm()
    fill()
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa nhận được xác nhận')
    expect(post).toHaveBeenCalledTimes(1)
    const first = post.mock.calls[0][1] as { requestId: string }
    expect(first.requestId).toMatch(/^[0-9a-f-]{36}$/i)
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại ngữ cảnh dịch vụ' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Gửi báo cáo sự cố dịch vụ' })).toBeEnabled(),
    )
    fill({ title: '  Sự cố  ', category: ' Khác ', description: ' Máy hỏng ' })
    submit()
    await screen.findByText('Đã tiếp nhận báo cáo — Chờ xem xét')
    expect(post.mock.calls[1][1]).toEqual(first)
    expect(screen.getByRole('button', { name: 'Hoàn thành công việc' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Báo sự cố khác' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Gửi báo cáo sự cố dịch vụ' })).toBeEnabled(),
    )
    fill()
    submit()
    await screen.findByText('Đã tiếp nhận báo cáo — Chờ xem xét')
    expect((post.mock.calls[2][1] as { requestId: string }).requestId).not.toBe(first.requestId)
    expect(patch).not.toHaveBeenCalled()
  },
)
it.each([400, 403, 404, 409])(
  'reports %s clearly, refreshes stale eligibility and never claims success',
  async (status) => {
    post.mockRejectedValue(failure(status))
    renderTask()
    await openForm()
    fill()
    if (status !== 400)
      get.mockImplementation(async (url) => ({
        data: String(url).endsWith('/context')
          ? { ...context, taskStatus: 'COMPLETED' }
          : { ...task, status: 'COMPLETED' },
      }))
    submit()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByText(
        new RegExp(
          {
            400: 'Thông tin báo cáo không hợp lệ',
            403: 'Bạn không có quyền báo',
            404: 'Không tìm thấy công việc',
            409: 'Điều kiện báo sự cố đã thay đổi',
          }[status]!,
        ),
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Đã tiếp nhận báo cáo — Chờ xem xét')).not.toBeInTheDocument()
    if (status !== 400)
      await waitFor(() =>
        expect(get.mock.calls.filter(([url]) => String(url).endsWith('/context'))).toHaveLength(2),
      )
    expect(patch).not.toHaveBeenCalled()
  },
)
