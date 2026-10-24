import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { UserMenu } from '@/features/auth/UserMenu'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { api } from '@/lib/api-client'
import { getIssue, listIssues, type IssueDetail, type IssueQuery } from './api'
import { issueKeys, useIssue } from './hooks'
import { issueRoutes } from './routes'

const detail: IssueDetail = {
  id: 'c'.repeat(24),
  title: 'Điều hòa hỏng',
  category: 'Phòng và tiện nghi',
  description: 'Không làm mát',
  bookingId: 'a'.repeat(24),
  roomId: 'b'.repeat(24),
  priority: 'NORMAL',
  status: 'PENDING_REVIEW',
  reportedAt: '2026-10-24T10:00:00Z',
  concludedAt: '2026-10-25T10:00:00Z',
  linkedTasks: [],
  linkedTasksAvailable: false,
}
const views = [
  ['CUSTOMER', '/customer/issues', 'Sự cố của tôi'],
  ['RECEPTIONIST', '/staff/issues', 'Yêu cầu sự cố'],
  ['MANAGER', '/manager/issues', 'Danh sách sự cố'],
] as const

function page(path: string, role: string | null = 'CUSTOMER') {
  return renderWithAuth([...issueRoutes, { path: '/login', element: <p>Đăng nhập ngay</p> }], {
    path,
    auth: role ? { status: 'authenticated', me: { ...ME, role, permissions: ['issue:read'] } } : {},
  })
}

beforeEach(() => vi.restoreAllMocks())

test.each(views)('%s sees exact role title, list and detail', async (role, path, title) => {
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: url === '/issues' ? { items: [detail], total: 1, page: 1, limit: 20 } : detail,
  }))
  const result = page(path, role)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
  fireEvent.click(await screen.findByRole('link', { name: detail.title }))
  expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent(detail.title)
  expect(screen.getByText(/Điều này không có nghĩa/)).toBeInTheDocument()
  expect(screen.getByText('Ngày kết luận')).toBeInTheDocument()
  expect(screen.getByText(detail.bookingId)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: detail.bookingId })).not.toBeInTheDocument()
  if (role === 'RECEPTIONIST')
    expect(screen.getByRole('button', { name: 'Xem xét' })).toBeInTheDocument()
  else
    expect(screen.queryByRole('button', { name: /Đóng|Phân công|Xem xét/ })).not.toBeInTheDocument()
  expect(result.router.state.location.pathname).toBe(`${path}/${detail.id}`)
})

test.each(views)(
  'guards %s routes against every other role and permission-only access',
  (allowed, path) => {
    const get = vi.spyOn(api, 'get')
    for (const role of [
      'CUSTOMER',
      'RECEPTIONIST',
      'MANAGER',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
      'CUSTOM_STAFF',
    ].filter((role) => role !== allowed)) {
      for (const suffix of ['', '/foreign']) {
        const result = page(`${path}${suffix}`, role)
        expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
        result.unmount()
      }
    }
    expect(get).not.toHaveBeenCalled()
  },
)

test('anonymous deep link redirects and static report wins over detail', async () => {
  const get = vi.spyOn(api, 'get')
  const guest = page('/customer/issues/foreign', null)
  expect(await screen.findByText('Đăng nhập ngay')).toBeInTheDocument()
  guest.unmount()
  page('/customer/issues/report?bookingId=context')
  expect(screen.getByLabelText(/Mã đặt phòng/)).toHaveValue('context')
  expect(get).not.toHaveBeenCalled()
})

test.each([
  ...views,
  ['SERVICE_STAFF', '', ''] as const,
  ['OPERATIONS_STAFF', '', ''] as const,
  ['CUSTOM_STAFF', '', ''] as const,
])('menu is exact-role for %s', (role, path, title) => {
  renderWithAuth([{ path: '/', element: <UserMenu /> }], {
    auth: { status: 'authenticated', me: { ...ME, role, permissions: ['issue:read'] } },
  })
  for (const [, candidate, label] of views) {
    if (candidate === path)
      expect(screen.getByRole('link', { name: title })).toHaveAttribute('href', path)
    else expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
  }
})

test('literal filters, pagination and resets use the live list contract', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { items: [detail], total: 41, page: 1, limit: 20 } })
  page('/customer/issues')
  expect(await screen.findByRole('link', { name: 'Báo sự cố mới' })).toHaveAttribute(
    'href',
    '/customer/issues/report',
  )
  await screen.findByText(detail.title)
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/issues', { params: { page: 2, limit: 20 } }),
  )
  fireEvent.change(screen.getByLabelText('Tìm theo tiêu đề'), { target: { value: '.*[' } })
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/issues', {
      params: { page: 1, limit: 20, keyword: '.*[' },
    }),
  )
  fireEvent.change(screen.getByLabelText('Nhóm sự cố (chính xác)'), {
    target: { value: ' Nhóm riêng ' },
  })
  fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'PENDING_REVIEW' } })
  fireEvent.change(screen.getByLabelText('Mức ưu tiên'), { target: { value: 'NORMAL' } })
  fireEvent.change(screen.getByLabelText('Số dòng mỗi trang'), { target: { value: '100' } })
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/issues', {
      params: {
        page: 1,
        limit: 100,
        keyword: '.*[',
        category: ' Nhóm riêng ',
        status: 'PENDING_REVIEW',
        priority: 'NORMAL',
      },
    }),
  )
})

test('API whitelists query fields and bounds pagination without actor parameters', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: {} })
  await listIssues({
    page: 20000,
    limit: 500,
    keyword: '.*',
    category: 'exact',
    actorId: 'evil',
    role: 'MANAGER',
    status: 'CLOSED',
    priority: 'HIGH',
  } as unknown as IssueQuery)
  expect(get).toHaveBeenLastCalledWith('/issues', {
    params: { page: 10000, limit: 100, keyword: '.*', category: 'exact', priority: 'HIGH' },
  })
  await listIssues({ page: 0, limit: Number.NaN })
  expect(get).toHaveBeenLastCalledWith('/issues', { params: { page: 1, limit: 20 } })
  await getIssue('a/b')
  expect(get).toHaveBeenLastCalledWith('/issues/a%2Fb')
})

test.each([403, 404, 500])('detail %s renders no foreign or server data', async (status) => {
  vi.spyOn(api, 'get').mockRejectedValue({
    isAxiosError: true,
    response: { status, data: { ...detail, guestEmail: 'private@example.com', message: 'secret' } },
  })
  page('/customer/issues/foreign')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    status === 403 ? 'không có quyền' : status === 404 ? 'Không tìm thấy' : 'Không thể tải',
  )
  expect(screen.queryByText(detail.title)).not.toBeInTheDocument()
  expect(screen.queryByText(/private@example.com|secret/)).not.toBeInTheDocument()
})

test('loading, empty and error retry states', async () => {
  const get = vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}))
  const loading = page('/customer/issues')
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải')
  loading.unmount()
  get
    .mockRejectedValueOnce(new Error('secret'))
    .mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 20 } })
  page('/customer/issues')
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải')
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText('Không có sự cố phù hợp.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
})

test('shared cache isolates users and roles and clears visible data on failed next identity', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const auth = { me: { ...ME, role: 'CUSTOMER' }, status: 'authenticated' } as AuthContextValue
  function Probe() {
    const result = useIssue(detail.id)
    return <p>{result.isSuccess ? result.data.title : result.isError ? 'denied' : 'loading'}</p>
  }
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValueOnce({ data: detail })
    .mockRejectedValue({ isAxiosError: true, response: { status: 404 } })
  const tree = (id: string, role: string) => (
    <QueryClientProvider client={client}>
      <AuthContext value={{ ...auth, me: { ...ME, id, role } }}>
        <MemoryRouter>
          <Probe />
        </MemoryRouter>
      </AuthContext>
    </QueryClientProvider>
  )
  const result = render(tree('one', 'CUSTOMER'))
  expect(await screen.findByText(detail.title)).toBeInTheDocument()
  result.rerender(tree('two', 'CUSTOMER'))
  expect(screen.queryByText(detail.title)).not.toBeInTheDocument()
  expect(await screen.findByText('denied')).toBeInTheDocument()
  result.rerender(tree('one', 'MANAGER'))
  expect(screen.queryByText(detail.title)).not.toBeInTheDocument()
  expect(await screen.findByText('denied')).toBeInTheDocument()
  expect(get).toHaveBeenCalledTimes(3)
  expect(issueKeys.list('one', 'CUSTOMER', { page: 1, limit: 20 })).not.toEqual(
    issueKeys.list('two', 'CUSTOMER', { page: 1, limit: 20 }),
  )
  expect(issueKeys.list('one', 'CUSTOMER', { page: 1, limit: 20 })).not.toEqual(
    issueKeys.list('one', 'MANAGER', { page: 1, limit: 20 }),
  )
})
