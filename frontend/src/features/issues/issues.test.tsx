import { fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AuthContext, useAuth } from '@/features/auth/auth-context'
import { useIssueReportContext } from './hooks'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { issueRoutes } from './routes'
import { reportIssue, validateIssue, type IssueInput, type IssueReceipt } from './api'

const bookingId = 'a'.repeat(24)
const roomId = 'b'.repeat(24)
const serviceOrderId = 'd'.repeat(24)
const otherId = 'e'.repeat(24)
const requestId = 'db5d155a-b672-4fc5-b1a6-764e654a9b68'
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
const booking = {
  id: bookingId,
  code: 'BK-2026-001',
  status: 'CHECKED_IN',
  checkIn: '2026-11-01T00:00:00Z',
  checkOut: '2026-11-15T00:00:00Z',
  rooms: [
    { id: roomId, roomNumber: '101' },
    { id: otherId, roomNumber: '102' },
  ],
  serviceOrders: [
    {
      id: serviceOrderId,
      serviceName: 'Giặt là',
      reviewStatus: 'REJECTED',
      executionStatus: 'COMPLETED',
    },
  ],
}

function renderPage(query = '', role: string | null = 'CUSTOMER') {
  return renderWithAuth([...issueRoutes, { path: '/login', element: <p>Đăng nhập ngay</p> }], {
    path: `/customer/issues/report${query}`,
    auth: role
      ? { status: 'authenticated', me: { ...ME, role, permissions: ['issue:create'] } }
      : {},
  })
}
async function ready() {
  return screen.findByRole('combobox', { name: /Đặt phòng/ })
}
function fill() {
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: input.title } })
  fireEvent.change(screen.getByLabelText(/Nhóm sự cố/), { target: { value: input.category } })
  fireEvent.change(screen.getByLabelText(/Mô tả/), { target: { value: input.description } })
}
function send() {
  fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
}
function mode(value: string) {
  fireEvent.change(screen.getByLabelText(/Ngữ cảnh/), { target: { value } })
}
beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [booking] } })
})

test('context query is identity scoped and disabled for non-customers', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let me = { ...ME, role: 'CUSTOMER' }
  const auth: ReturnType<typeof useAuth> = {
    me,
    status: 'authenticated',
    isDevMode: false,
    login: vi.fn(),
    loginAsDev: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext value={{ ...auth, me }}>{children}</AuthContext>
    </QueryClientProvider>
  )
  const { result, rerender } = renderHook(useIssueReportContext, { wrapper })
  await waitFor(() => expect(result.current.data?.items[0].code).toBe('BK-2026-001'))
  vi.mocked(api.get).mockResolvedValue({ data: { items: [] } })
  me = { ...me, id: 'second-customer' }
  rerender()
  expect(result.current.data).toBeUndefined()
  await waitFor(() => expect(result.current.data?.items).toEqual([]))
  expect(api.get).toHaveBeenCalledTimes(2)
  me = { ...me, role: 'MANAGER' }
  rerender()
  expect(result.current.data).toBeUndefined()
  expect(api.get).toHaveBeenCalledTimes(2)
})

test('guest is redirected to login', async () => {
  renderPage('', null)
  expect(await screen.findByText('Đăng nhập ngay')).toBeInTheDocument()
})
test.each(['MANAGER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF', 'CUSTOM_STAFF'])(
  'denies %s even with create permission',
  (role) => {
    renderPage('', role)
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  },
)
test('eager context shows readable booking dates status and rooms, with no manual IDs', async () => {
  renderPage()
  const select = await ready()
  expect(select).toHaveValue(bookingId)
  expect(
    within(select).getByRole('option', {
      name: /BK-2026-001.*1\/11\/2026.*15\/11\/2026.*Đang lưu trú.*101.*102/,
    }),
  ).toBeInTheDocument()
  expect(api.get).toHaveBeenCalledWith('/issues/report-context')
  expect(
    screen.getByText(
      'Cho chúng tôi biết vấn đề. Khách sạn sẽ xem xét báo cáo trước khi giao xử lý.',
    ),
  ).toBeInTheDocument()
  expect(screen.queryByText(/chúng tôi sẽ cử người đến xử lý/)).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: /Đặt phòng|Mã phòng/ })).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/Thiết bị|Mức độ/)).not.toBeInTheDocument()
  const form = screen.getByRole('button', { name: 'Gửi báo cáo' }).closest('form')!
  expect(form).toHaveClass('grid', 'max-w-2xl', 'gap-4')
  expect(form.closest('section')).toHaveClass('card-soft')
  expect(screen.getByLabelText(/Tiêu đề/)).toHaveAttribute('maxlength', '200')
  expect(screen.getByLabelText(/Mô tả/)).toHaveAttribute('maxlength', '5000')
})
test('multiple bookings require explicit selection and reset dependent selectors on booking and mode changes', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      items: [booking, { ...booking, id: otherId, code: 'BK-002', rooms: [], serviceOrders: [] }],
    },
  })
  const post = vi.spyOn(api, 'post')
  renderPage()
  const select = await ready()
  expect(select).toHaveValue('')
  fill()
  send()
  expect(select).toHaveAttribute('aria-invalid', 'true')
  expect(post).not.toHaveBeenCalled()
  fireEvent.change(select, { target: { value: bookingId } })
  mode('room')
  fireEvent.change(screen.getByLabelText(/^Phòng/), { target: { value: roomId } })
  expect(screen.getByLabelText(/^Phòng/)).toHaveValue(roomId)
  mode('service')
  fireEvent.change(screen.getByLabelText(/Đơn dịch vụ/), { target: { value: serviceOrderId } })
  mode('room')
  expect(screen.getByLabelText(/^Phòng/)).toHaveValue('')
  fireEvent.change(select, { target: { value: otherId } })
  expect(screen.getByLabelText(/Ngữ cảnh/)).toHaveValue('booking')
  expect(screen.queryByLabelText(/^Phòng/)).not.toBeInTheDocument()
  mode('room')
  expect(screen.getByLabelText(/^Phòng/)).toHaveValue('')
  expect(screen.queryByRole('option', { name: 'Phòng 101' })).not.toBeInTheDocument()
  send()
  expect(post).not.toHaveBeenCalled()
  expect(api.get).toHaveBeenCalledTimes(1)
})
test.each(['room', 'service'])(
  'validates and submits %s prefill using IDs not readable codes',
  async (contextMode) => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: receipt })
    const extra = contextMode === 'room' ? { roomId } : { serviceOrderId }
    renderPage(`?bookingId=${bookingId}&${Object.keys(extra)[0]}=${Object.values(extra)[0]}`)
    await ready()
    expect(screen.getByLabelText(/Ngữ cảnh/)).toHaveValue(contextMode)
    fill()
    send()
    await screen.findByText('Đã tiếp nhận báo cáo')
    expect(post).toHaveBeenCalledWith('/issues', {
      ...input,
      ...extra,
      requestId: expect.any(String),
    })
    expect(post.mock.calls[0][1]).toHaveProperty(
      'requestId',
      expect.stringMatching(/^[a-f\d-]{36}$/i),
    )
    expect(screen.getByRole('status')).toHaveTextContent('BK-2026-001')
    expect(screen.getByRole('status')).toHaveTextContent(
      contextMode === 'room' ? 'Phòng 101' : 'Giặt là',
    )
    expect(screen.getByRole('status')).not.toHaveTextContent(bookingId)
  },
)
test.each([
  '?bookingId=foreign&roomId=invalid',
  `?bookingId=${bookingId}&roomId=${'f'.repeat(24)}`,
  `?bookingId=${bookingId}&serviceOrderId=${'f'.repeat(24)}`,
  `?bookingId=${bookingId}&roomId=${roomId}&serviceOrderId=${serviceOrderId}`,
])('rejects invalid or ambiguous prefills %s until corrected', async (query) => {
  const post = vi.spyOn(api, 'post')
  renderPage(query)
  const select = await ready()
  expect(screen.getByRole('alert')).toHaveTextContent('Liên kết')
  fill()
  send()
  expect(post).not.toHaveBeenCalled()
  fireEvent.change(select, { target: { value: bookingId } })
  mode('booking')
  send()
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
})
test('loading, failure retry and no eligible bookings never allow a new submission', async () => {
  let reject!: (reason: unknown) => void
  vi.mocked(api.get)
    .mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail
        }),
    )
    .mockResolvedValueOnce({ data: { items: [] } })
  const post = vi.spyOn(api, 'post')
  renderPage()
  expect(screen.getByLabelText('Đang tải ngữ cảnh báo sự cố')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Gửi báo cáo' })).not.toBeInTheDocument()
  reject(new Error('network'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được')
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Chỉ dùng được khi đang lưu trú')).toBeInTheDocument()
  expect(post).not.toHaveBeenCalled()
})
test('only checked-in bookings are selectable even if context contains stale statuses', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      items: [
        booking,
        ...['CONFIRMED', 'CHECKED_OUT', 'CANCELLED'].map((status, index) => ({
          ...booking,
          id: `${index}`.repeat(24),
          code: `INELIGIBLE-${status}`,
          status,
        })),
      ],
    },
  })
  renderPage()
  const select = await ready()
  expect(select).toHaveValue(bookingId)
  expect(within(select).getAllByRole('option')).toHaveLength(2)
  expect(screen.queryByRole('option', { name: /INELIGIBLE/ })).not.toBeInTheDocument()
})
test('focuses first invalid field with associated errors', async () => {
  renderPage()
  await ready()
  send()
  expect(screen.getByLabelText(/Tiêu đề/)).toHaveFocus()
  for (const label of [/Tiêu đề/, /Nhóm sự cố/, /Mô tả/]) {
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(/Vui lòng/)
  }
})
test('blocks double submission until confirmed and starts a new intent for another report', async () => {
  let resolve!: (value: { data: IssueReceipt }) => void
  const post = vi
    .spyOn(api, 'post')
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    .mockResolvedValue({ data: receipt })
  renderPage()
  await ready()
  fill()
  send()
  const button = screen.getByRole('button', { name: 'Gửi báo cáo' })
  fireEvent.submit(button.closest('form')!)
  expect(button).toBeDisabled()
  expect(screen.queryByText('Đã tiếp nhận báo cáo')).not.toBeInTheDocument()
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
  resolve({ data: receipt })
  await screen.findByText('Đã tiếp nhận báo cáo')
  expect(screen.getByRole('status')).toHaveTextContent('Chờ xem xét')
  expect(screen.getByRole('status')).toHaveTextContent(receipt.id)
  expect(screen.getByRole('status').querySelector('dl')).toHaveClass('break-words')
  fireEvent.click(screen.getByRole('button', { name: 'Báo sự cố khác' }))
  await ready()
  fill()
  send()
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect(post.mock.calls[1][1]).not.toHaveProperty(
    'requestId',
    (post.mock.calls[0][1] as { requestId: string }).requestId,
  )
})
test.each([400, 404, 409])(
  'refreshes stale context after %s and rejects stale selection',
  async (status) => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { items: [booking] } })
      .mockResolvedValue({ data: { items: [] } })
    const post = vi.spyOn(api, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status, data: { message: 'INTERNAL jargon' } },
    })
    renderPage()
    await ready()
    fill()
    send()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Chỉ dùng được khi đang lưu trú')).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('INTERNAL jargon')).not.toBeInTheDocument()
  },
)
test.each([undefined, 500, 401, 403])(
  'preserves normalized payload requestId for explicit retry after %s',
  async (status) => {
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce({ isAxiosError: true, response: status ? { status } : undefined })
      .mockResolvedValue({ data: receipt })
    renderPage()
    await ready()
    fill()
    send()
    await screen.findByRole('alert')
    expect(post).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: ` ${input.title} ` } })
    send()
    await screen.findByText('Đã tiếp nhận báo cáo')
    expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1])
  },
)
test('changed normalized payload gets a new key after uncertain failure', async () => {
  const post = vi.spyOn(api, 'post').mockRejectedValue(new Error('network'))
  renderPage()
  await ready()
  fill()
  send()
  await screen.findByRole('alert')
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Vòi sen hỏng' } })
  send()
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect((post.mock.calls[1][1] as { requestId: string }).requestId).not.toBe(
    (post.mock.calls[0][1] as { requestId: string }).requestId,
  )
})
test('returning to an uncertain payload retains its UUID after another failed intent', async () => {
  const post = vi.spyOn(api, 'post').mockRejectedValue(new Error('network'))
  renderPage()
  await ready()
  fill()
  send()
  await screen.findByRole('alert')
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: 'Vòi sen hỏng' } })
  send()
  await screen.findByRole('alert')
  fireEvent.change(screen.getByLabelText(/Tiêu đề/), { target: { value: input.title } })
  send()
  await waitFor(() => expect(post).toHaveBeenCalledTimes(3))
  expect(post.mock.calls[2][1]).toEqual(post.mock.calls[0][1])
})
test.each([
  ['empty', 'booking'],
  ['error', 'booking'],
  ['empty', 'room'],
  ['error', 'room'],
  ['empty', 'service'],
  ['error', 'service'],
])(
  'uncertain replay remains possible after context refetch becomes %s in %s mode',
  async (state, contextMode) => {
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ data: receipt })
    const reference =
      contextMode === 'room'
        ? `&roomId=${roomId}`
        : contextMode === 'service'
          ? `&serviceOrderId=${serviceOrderId}`
          : ''
    renderPage(`?bookingId=${bookingId}${reference}`)
    await ready()
    fill()
    send()
    await screen.findByRole('alert')
    if (state === 'empty') vi.mocked(api.get).mockResolvedValue({ data: { items: [] } })
    else vi.mocked(api.get).mockRejectedValue(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới ngữ cảnh' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    send()
    await screen.findByText('Đã tiếp nhận báo cáo')
    expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1])
    expect(screen.getByRole('status')).toHaveTextContent('BK-2026-001')
  },
)
test('long success values wrap and service options include all returned states', async () => {
  const title = 'Sự cố trong phòng '.repeat(11).trim()
  vi.spyOn(api, 'post').mockResolvedValue({ data: { ...receipt, title, serviceOrderId } })
  renderPage(`?bookingId=${bookingId}&serviceOrderId=${serviceOrderId}`)
  await ready()
  expect(
    screen.getByRole('option', { name: /Giặt là.*Đã từ chối.*Đã hoàn thành/ }),
  ).toBeInTheDocument()
  fill()
  send()
  await screen.findByText('Đã tiếp nhận báo cáo')
  expect(screen.getByText(title)).toBeInTheDocument()
  expect(screen.getByRole('status').querySelector('dl')).toHaveClass('break-words')
})

test('API whitelists normalized fields and requires UUID without blocking service references', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: receipt })
  await reportIssue({
    ...input,
    requestId,
    title: ` ${input.title} `,
    roomId: ' ',
    serviceOrderId,
    priority: 'HIGH',
  } as IssueInput & { requestId: string })
  expect(post).toHaveBeenCalledWith('/issues', { ...input, requestId, serviceOrderId })
  await expect(
    reportIssue({ ...input, requestId: 'invalid' } as IssueInput & { requestId: string }),
  ).rejects.toThrow()
  await expect(reportIssue(input as IssueInput & { requestId: string })).rejects.toThrow()
  expect(post).toHaveBeenCalledTimes(1)
})
test('validates blank, lengths and optional references', () => {
  expect(validateIssue(input)).toEqual({})
  for (const [key, limit] of [
    ['title', 200],
    ['category', 100],
    ['description', 5000],
  ] as const) {
    expect(validateIssue({ ...input, [key]: ' ' })).toHaveProperty(key)
    expect(validateIssue({ ...input, [key]: 'x'.repeat(limit) })).toEqual({})
    expect(validateIssue({ ...input, [key]: 'x'.repeat(limit + 1) })).toHaveProperty(key)
  }
  expect(validateIssue({ ...input, bookingId: '' })).toHaveProperty('bookingId')
  expect(validateIssue({ ...input, roomId: 'invalid' })).toHaveProperty('roomId')
  expect(validateIssue({ ...input, serviceOrderId: 'invalid' })).toHaveProperty('serviceOrderId')
})
