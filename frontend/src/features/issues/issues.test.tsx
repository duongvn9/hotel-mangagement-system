import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { issueRoutes } from './routes'
import { reportIssue, validateIssue, type IssueInput, type IssueReceipt } from './api'

const bookingId = 'a'.repeat(24)
const roomId = 'b'.repeat(24)
const input: IssueInput = {
  title: 'Điều hòa hỏng',
  category: 'Phòng và tiện nghi',
  description: 'Không làm mát',
  bookingId,
}
const receipt: IssueReceipt = {
  ...input,
  id: 'c'.repeat(24),
  priority: 'NORMAL',
  status: 'PENDING_REVIEW',
  reportedAt: '2026-10-24T10:00:00Z',
}

function renderPage(query = '', role: string | null = 'CUSTOMER') {
  return renderWithAuth([...issueRoutes, { path: '/login', element: <p>Đăng nhập ngay</p> }], {
    path: `/customer/issues/report${query}`,
    auth: role
      ? { status: 'authenticated', me: { ...ME, role, permissions: ['issue:create'] } }
      : {},
  })
}

function fill() {
  fireEvent.change(screen.getByLabelText(/Mã đặt phòng/), { target: { value: bookingId } })
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: input.title } })
  fireEvent.change(screen.getByLabelText(/Nhóm sự cố/), { target: { value: input.category } })
  fireEvent.change(screen.getByLabelText(/Mô tả/), { target: { value: input.description } })
}

beforeEach(() => vi.restoreAllMocks())

test('guest is redirected to login', async () => {
  renderPage('', null)
  expect(await screen.findByText('Đăng nhập ngay')).toBeInTheDocument()
})

test.each(['MANAGER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF', 'CUSTOM_STAFF'])(
  'denies %s even with create permission',
  (role) => {
    renderPage('', role)
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gửi báo cáo' })).not.toBeInTheDocument()
  },
)

test('prefills untrusted context and validates it without submitting', () => {
  const post = vi.spyOn(api, 'post')
  renderPage('?bookingId=foreign&roomId=invalid&priority=URGENT&reporterId=other')
  expect(screen.getByLabelText(/Mã đặt phòng/)).toHaveValue('foreign')
  expect(screen.getByLabelText(/Mã phòng/)).toHaveValue('invalid')
  fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
  expect(screen.getByLabelText(/Mã đặt phòng/)).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText(/Mã phòng/)).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText(/Tiêu đề/)).toHaveAttribute('aria-invalid', 'true')
  expect(post).not.toHaveBeenCalled()
})

test('service order query blocks submission and is not a supported option', () => {
  const post = vi.spyOn(api, 'post')
  renderPage(`?bookingId=${bookingId}&serviceOrderId=untrusted`)
  expect(screen.getByRole('alert')).toHaveTextContent('Chưa hỗ trợ')
  expect(screen.getByRole('button', { name: 'Gửi báo cáo' })).toBeDisabled()
  expect(post).not.toHaveBeenCalled()
})

test('submits only trimmed allowed fields using shared API', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: receipt })
  await reportIssue({
    ...input,
    title: ` ${input.title} `,
    description: ` ${input.description} `,
    category: ` ${input.category} `,
    bookingId: ` ${bookingId} `,
    roomId: ` ${roomId} `,
    reporterId: 'evil',
    priority: 'HIGH',
    status: 'CLOSED',
  } as IssueInput)
  expect(post).toHaveBeenCalledWith('/issues', { ...input, roomId })
  post.mockClear()
  await reportIssue({ ...input, roomId: ' ' })
  expect(post).toHaveBeenCalledWith('/issues', input)
  await expect(reportIssue({ ...input, serviceOrderId: 'evil' } as IssueInput)).rejects.toThrow()
  expect(post).toHaveBeenCalledTimes(1)
})

test('blocks double submission and shows receipt only after confirmed success', async () => {
  let resolve!: (value: { data: IssueReceipt }) => void
  const post = vi.spyOn(api, 'post').mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  renderPage(`?bookingId=${bookingId}&roomId=${roomId}`)
  fill()
  const button = screen.getByRole('button', { name: 'Gửi báo cáo' })
  fireEvent.click(button)
  fireEvent.submit(button.closest('form')!)
  expect(button).toBeDisabled()
  expect(screen.queryByText('Đã tiếp nhận báo cáo')).not.toBeInTheDocument()
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
  resolve({ data: receipt })
  expect(await screen.findByText('Đã tiếp nhận báo cáo')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Chờ xem xét')
  expect(screen.getByRole('status')).toHaveTextContent(receipt.id)
  expect(screen.queryByRole('button', { name: 'Gửi báo cáo' })).not.toBeInTheDocument()
})

test.each([
  [400, 'Thông tin chưa hợp lệ'],
  [403, 'Bạn không có quyền'],
  [404, 'Không tìm thấy đặt phòng'],
  [undefined, 'Chưa nhận được xác nhận'],
])('handles %s without optimistic success or raw server errors', async (status, message) => {
  const post = vi.spyOn(api, 'post').mockRejectedValue({
    isAxiosError: true,
    response: status ? { status, data: { message: 'INTERNAL jargon' } } : undefined,
  })
  renderPage()
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.queryByText('Đã tiếp nhận báo cáo')).not.toBeInTheDocument()
  expect(screen.queryByText('INTERNAL jargon')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gửi báo cáo' })).toBeEnabled()
  expect(screen.getByLabelText(/Tiêu đề/)).toHaveValue(input.title)
  expect(post).toHaveBeenCalledTimes(1)
})

test('validates blank, length limits and optional references', () => {
  expect(validateIssue(input)).toEqual({})
  expect(
    validateIssue({
      ...input,
      title: ' '.repeat(3),
      category: ' ',
      description: '\n',
      bookingId: '',
    }),
  ).toHaveProperty('title')
  for (const [key, limit] of [
    ['title', 200],
    ['category', 100],
    ['description', 5000],
  ] as const) {
    expect(validateIssue({ ...input, [key]: 'x'.repeat(limit) })).toEqual({})
    expect(validateIssue({ ...input, [key]: 'x'.repeat(limit + 1) })).toHaveProperty(key)
  }
  expect(validateIssue({ ...input, roomId: 'not-a-room' })).toHaveProperty('roomId')
})
