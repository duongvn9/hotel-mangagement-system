import { fireEvent, screen, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { api } from '@/lib/api-client'
import { IssueTaskRecovery } from './IssueTaskRecovery'
import { useIssue } from './hooks'
import type { IssueDetail, ReassignmentIntent } from './api'
import { AssignedTaskDetailPage } from '@/features/tasks/pages/AssignedTaskDetailPage'
import type { AssignedTask } from '@/features/tasks/api'

const task: AssignedTask = {
  id: 'a'.repeat(24),
  title: 'Sửa điều hòa',
  taskType: 'ISSUE_RESOLUTION',
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  assignedAt: '2026-10-01T00:00:00Z',
  sourceType: 'ISSUE',
  sourceId: 'b'.repeat(24),
  sourceSummary: null,
  blocked: true,
  overdue: true,
  blockerHistory: [
    {
      id: 'report',
      reason: 'Thiếu linh kiện',
      reportedBy: 'staff',
      reportedAt: '2026-10-02T00:00:00Z',
    },
  ],
}
const issue: IssueDetail = {
  id: task.sourceId,
  title: 'Điều hòa',
  category: 'AC',
  description: 'Hỏng',
  bookingId: 'booking',
  priority: 'HIGH',
  status: 'ASSIGNED',
  reportedAt: task.assignedAt,
  handlingCategory: 'OPERATIONS',
  needsStaffAction: true,
  linkedTasksAvailable: true,
  linkedTasks: [{ ...task, assigneeId: 'old' }],
  resolutionTasks: [{ ...task, assigneeId: 'old' }],
}
const users = {
  items: [
    { id: 'old', displayName: 'Cũ', role: 'OPERATIONS_STAFF' },
    { id: 'new', displayName: 'Mới', role: 'OPERATIONS_STAFF' },
    { id: 'wrong', displayName: 'Sai nhóm', role: 'SERVICE_STAFF' },
  ],
}
function mount(value = issue, role = 'RECEPTIONIST') {
  return renderWithAuth([{ path: '/', element: <IssueTaskRecovery issue={value} /> }], {
    auth: { status: 'authenticated', me: { ...ME, role } },
  })
}
function error(status: number) {
  return new AxiosError('Failed', undefined, undefined, undefined, {
    status,
    data: {},
  } as AxiosResponse)
}
beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: users })
})
afterEach(() => vi.restoreAllMocks())

it('validates report reason, confirms trimmed input and shows success without cancelling progress', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: task })
  const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: task })
  renderWithAuth([{ path: '/tasks/:id', element: <AssignedTaskDetailPage /> }], {
    path: `/tasks/${task.id}`,
    auth: { status: 'authenticated', me: { ...ME, role: 'OPERATIONS_STAFF' } },
  })
  await screen.findByRole('heading', { name: task.title })
  expect(screen.getByRole('button', { name: 'Hoàn thành công việc' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Báo không thể xử lý' }))
  expect(screen.getByText('Vui lòng nhập lý do từ 1 đến 2000 ký tự.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Lý do không thể xử lý (bắt buộc)'), {
    target: { value: '  Thiếu dụng cụ  ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Báo không thể xử lý' }))
  expect(patch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận báo cáo' }))
  await screen.findByText('Đã báo không thể xử lý. Chờ lễ tân xem xét.')
  expect(patch).toHaveBeenCalledExactlyOnceWith(`/tasks/${task.id}/unable-to-resolve`, {
    reason: 'Thiếu dụng cụ',
  })
  expect(screen.queryByRole('button', { name: /Hủy/ })).not.toBeInTheDocument()
})

it.each([400, 403, 404, 409, 500])(
  'renders report failure %s without reporting success',
  async (status) => {
    vi.mocked(api.get).mockResolvedValue({ data: task })
    vi.spyOn(api, 'patch').mockRejectedValue(error(status))
    renderWithAuth([{ path: '/tasks/:id', element: <AssignedTaskDetailPage /> }], {
      path: `/tasks/${task.id}`,
      auth: { status: 'authenticated', me: { ...ME, role: 'SERVICE_STAFF' } },
    })
    await screen.findByLabelText('Lý do không thể xử lý (bắt buộc)')
    fireEvent.change(screen.getByLabelText('Lý do không thể xử lý (bắt buộc)'), {
      target: { value: 'Thiếu dụng cụ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Báo không thể xử lý' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận báo cáo' }))
    await screen.findByRole('alert')
    expect(
      screen.queryByText('Đã báo không thể xử lý. Chờ lễ tân xem xét.'),
    ).not.toBeInTheDocument()
  },
)

it('continues the same task with optional trimmed instructions and deadline', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: issue })
  mount()
  fireEvent.change(screen.getByLabelText('Hướng dẫn tiếp tục (không bắt buộc)'), {
    target: { value: '  Dùng linh kiện mới  ' },
  })
  fireEvent.change(screen.getByLabelText('Thời hạn mới (không bắt buộc)'), {
    target: { value: '2026-11-01T10:00' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xử lý' }))
  expect(post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await screen.findByText('Đã cập nhật xử lý sự cố.')
  expect(post).toHaveBeenCalledExactlyOnceWith(`/issues/${issue.id}/continue`, {
    taskId: task.id,
    instructions: 'Dùng linh kiện mới',
    dueAt: new Date('2026-11-01T10:00').toISOString(),
  })
})

it('rejects missing reason, excludes same/wrong category staff, and keeps requestId across transient retry', async () => {
  const post = vi
    .spyOn(api, 'post')
    .mockRejectedValueOnce(error(500))
    .mockResolvedValue({ data: issue })
  mount()
  await screen.findByRole('option', { name: 'Mới' })
  expect(screen.queryByRole('option', { name: 'Cũ' })).not.toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Sai nhóm' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Phân công lại' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Chọn nhân viên khác phù hợp')
  fireEvent.change(screen.getByLabelText('Nhân viên thay thế'), { target: { value: 'new' } })
  fireEvent.change(screen.getByLabelText('Lý do phân công lại (bắt buộc)'), {
    target: { value: '  Cần chuyên môn  ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Phân công lại' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await screen.findByText(/Chưa thể hoàn tất/)
  fireEvent.click(screen.getByRole('button', { name: 'Khôi phục phân công lại' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect(post.mock.calls[0]).toEqual(post.mock.calls[1])
  expect(post.mock.calls[0][1]).toEqual(
    expect.objectContaining({
      reason: 'Cần chuyên môn',
      requestId: expect.any(String),
      assigneeId: 'new',
    }),
  )
})

const pending: ReassignmentIntent = {
  taskId: task.id,
  assigneeId: 'inactive',
  reason: 'Thiếu chuyên môn',
  requestId: 'stable-request',
  actorId: 'another-receptionist',
  requestedAt: task.assignedAt,
  taskRevision: 1,
  targetTaskId: 'target',
  recoveryActors: [],
  abandonedTargets: [],
  dueAt: '2026-11-01T00:00:00Z',
}
it('allows a different receptionist to recover an inactive target with identical intent and replacement', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: issue })
  mount({
    ...issue,
    pendingReassignment: pending,
    resolutionTasks: [{ ...issue.resolutionTasks![0], status: 'CANCELLED' }],
  })
  await screen.findByRole('option', { name: 'Mới' })
  expect(screen.getByText(/Bất kỳ lễ tân/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tiếp tục xử lý' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Nhân viên thay thế'), { target: { value: 'new' } })
  fireEvent.click(screen.getByRole('button', { name: 'Khôi phục với nhân viên thay thế' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await waitFor(() =>
    expect(post).toHaveBeenCalledExactlyOnceWith(`/issues/${issue.id}/reassign`, {
      taskId: task.id,
      assigneeId: 'new',
      reason: pending.reason,
      requestId: pending.requestId,
      dueAt: pending.dueAt,
    }),
  )
})
it('recovers eligible pending target without changing input', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: issue })
  mount({ ...issue, pendingReassignment: { ...pending, assigneeId: 'new' } })
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Khôi phục phân công lại' })).toBeEnabled(),
  )
  expect(screen.queryByLabelText('Nhân viên thay thế')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Khôi phục phân công lại' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      `/issues/${issue.id}/reassign`,
      expect.objectContaining({ requestId: pending.requestId, assigneeId: 'new' }),
    ),
  )
})
it.each([true, false])(
  'replays inactive original target with existing target=%s without requiring replacement',
  async (exists) => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: issue })
    if (!exists) vi.mocked(api.get).mockRejectedValue(error(500))
    mount({
      ...issue,
      pendingReassignment: pending,
      resolutionTasks: exists
        ? [
            ...issue.resolutionTasks!,
            {
              ...issue.resolutionTasks![0],
              id: pending.targetTaskId,
              assigneeId: pending.assigneeId,
            },
          ]
        : undefined,
    })
    if (exists) await waitFor(() => expect(api.get).toHaveBeenCalled())
    else await screen.findByText('Không thể tải nhân viên phù hợp.')
    expect(screen.queryByLabelText('Nhân viên thay thế')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Khôi phục với nhân viên thay thế' }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục phân công lại' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`/issues/${issue.id}/reassign`, {
        taskId: pending.taskId,
        assigneeId: pending.assigneeId,
        reason: pending.reason,
        requestId: pending.requestId,
        dueAt: pending.dueAt,
      }),
    )
  },
)

function LiveRecovery() {
  const result = useIssue(issue.id)
  return result.data ? <IssueTaskRecovery issue={result.data} /> : <p>Loading</p>
}

it('clears a revision-conflicted local intent after authoritative reload without remount and uses a new UUID', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: String(url).endsWith('/assignees') ? users : issue,
  }))
  const post = vi
    .spyOn(api, 'post')
    .mockRejectedValueOnce(error(409))
    .mockResolvedValue({ data: issue })
  renderWithAuth([{ path: '/', element: <LiveRecovery /> }], {
    auth: { status: 'authenticated', me: { ...ME, role: 'RECEPTIONIST' } },
  })
  await screen.findByRole('option', { name: 'Mới' })
  fireEvent.change(screen.getByLabelText('Nhân viên thay thế'), { target: { value: 'new' } })
  fireEvent.change(screen.getByLabelText('Lý do phân công lại (bắt buộc)'), {
    target: { value: 'Đổi người' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Phân công lại' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await screen.findByText(/Trạng thái hoặc ý định đã thay đổi/)
  expect(screen.getByRole('button', { name: 'Tiếp tục xử lý' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Khôi phục phân công lại' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Phân công lại' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect((post.mock.calls[0][1] as { requestId: string }).requestId).not.toBe(
    (post.mock.calls[1][1] as { requestId: string }).requestId,
  )
})

it('preserves the UUID when authoritative reload fails, then releases it after a successful manual reload', async () => {
  let detailReads = 0
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (String(url).endsWith('/assignees')) return { data: users }
    if (++detailReads === 1 || detailReads >= 4) return { data: issue }
    throw error(500)
  })
  const post = vi.spyOn(api, 'post').mockRejectedValue(error(500))
  renderWithAuth([{ path: '/', element: <LiveRecovery /> }], {
    auth: { status: 'authenticated', me: { ...ME, role: 'RECEPTIONIST' } },
  })
  await screen.findByRole('option', { name: 'Mới' })
  fireEvent.change(screen.getByLabelText('Nhân viên thay thế'), { target: { value: 'new' } })
  fireEvent.change(screen.getByLabelText('Lý do phân công lại (bắt buộc)'), {
    target: { value: 'Đổi người' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Phân công lại' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await screen.findByText(/Chưa thể hoàn tất/)
  fireEvent.click(screen.getByRole('button', { name: 'Khôi phục phân công lại' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await waitFor(() => expect(detailReads).toBe(3))
  expect(post.mock.calls[0]).toEqual(post.mock.calls[1])
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Tải lại trạng thái xử lý' })).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại trạng thái xử lý' }))
  await screen.findByRole('button', { name: 'Tiếp tục xử lý' })
})

it('retains the original request after an authoritative reload confirms the same pending intent', async () => {
  let saved: ReassignmentIntent | undefined
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: String(url).endsWith('/assignees') ? users : { ...issue, pendingReassignment: saved },
  }))
  const post = vi.spyOn(api, 'post').mockImplementation(async (_, body) => {
    saved = { ...pending, dueAt: undefined, ...(body as ReassignmentIntent) }
    throw error(500)
  })
  renderWithAuth([{ path: '/', element: <LiveRecovery /> }], {
    auth: { status: 'authenticated', me: { ...ME, role: 'RECEPTIONIST' } },
  })
  await screen.findByRole('option', { name: 'Mới' })
  fireEvent.change(screen.getByLabelText('Nhân viên thay thế'), { target: { value: 'new' } })
  fireEvent.change(screen.getByLabelText('Lý do phân công lại (bắt buộc)'), {
    target: { value: 'Đổi người' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Phân công lại' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await screen.findByText(/Chưa thể hoàn tất/)
  expect(screen.queryByRole('button', { name: 'Tiếp tục xử lý' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Khôi phục phân công lại' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect(post.mock.calls[0]).toEqual(post.mock.calls[1])
})

it('shows Manager blocked history and pending intent read-only without requesting assignees', () => {
  const post = vi.spyOn(api, 'post')
  mount({ ...issue, pendingReassignment: pending }, 'MANAGER')
  expect(screen.getByText(/Lý do không thể xử lý: Thiếu linh kiện/)).toBeInTheDocument()
  expect(screen.getByText(/Bị chặn/)).toBeInTheDocument()
  expect(screen.getByText('Quá hạn')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(api.get).not.toHaveBeenCalled()
  expect(post).not.toHaveBeenCalled()
})
it.each([400, 403, 404, 409, 500])('shows continue failure %s without success', async (status) => {
  vi.spyOn(api, 'post').mockRejectedValue(error(status))
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xử lý' }))
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xử lý công việc' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Đã cập nhật xử lý sự cố.')).not.toBeInTheDocument()
})

it('handles assignee loading failure with retry and no unsafe reassignment', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(error(500)).mockResolvedValue({ data: users })
  const post = vi.spyOn(api, 'post')
  mount()
  await screen.findByText('Không thể tải nhân viên phù hợp.')
  fireEvent.click(screen.getByRole('button', { name: 'Phân công lại' }))
  expect(post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại nhân viên' }))
  await screen.findByRole('option', { name: 'Mới' })
})
