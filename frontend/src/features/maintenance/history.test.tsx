import { configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { maintenanceRoutes } from './routes'
import type { HistoryDetail, HistoryItem } from './api'

const item: HistoryItem = {
  id: 'record1',
  reportedAt: '2026-10-24T17:05:00.000Z',
  description: 'Điều hòa phát tiếng ồn khi vận hành',
  requiresAction: true,
  preventsSafeUse: true,
  status: 'COMPLETED',
  completedAt: '2026-10-25T03:00:00Z',
  target: {
    room: { id: 'room1', roomNumber: '102', floor: 1 },
    equipment: {
      id: 'device1',
      assetCode: 'AC-102',
      name: 'Điều hòa',
      category: 'Điện',
      location: 'Phòng 102',
    },
    facilityLocation: null,
  },
}
const detail: HistoryDetail = {
  ...item,
  reportedBy: { id: 'ops1', fullName: 'Người báo' },
  task: {
    id: 'task1',
    title: 'Bảo trì điều hòa',
    priority: 'NORMAL',
    status: 'COMPLETED',
    assignee: { id: 'ops2', fullName: 'Người thực hiện' },
    assignedAt: '2026-10-25T00:00:00Z',
    dueAt: '2026-10-26T00:00:00Z',
    completedAt: '2026-10-25T03:00:00Z',
    workResult: 'Đã thay bộ lọc và chạy thử an toàn',
  },
}
const page = (items: HistoryItem[] = [item], total = items.length) => ({
  data: { items, total, page: 1, limit: 10 },
})
const root = '/operations/maintenance/history'
function renderPage(path = root, role = 'OPERATIONS_STAFF') {
  return renderWithAuth(
    [...maintenanceRoutes, { path: '/login', element: <p>Đăng nhập test</p> }],
    { path, auth: { me: { ...ME, role, permissions: ['issue:report'] }, status: 'authenticated' } },
  )
}
describe('UC36 maintenance history', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue(page())
  })
  afterEach(() => vi.restoreAllMocks())
  it('renders columns, Vietnam business time, full description tooltip and real detail link', async () => {
    renderPage()
    await screen.findByRole('table', { name: 'Lịch sử bảo trì' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    for (const label of [
      'Thời điểm báo cáo',
      'Đối tượng',
      'Mô tả',
      'Trạng thái',
      'Ngăn dùng phòng an toàn',
    ])
      expect(screen.getByRole('columnheader', { name: label })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem bản ghi 25/10/2026 00:05' })).toHaveAttribute(
      'href',
      `${root}/record1`,
    )
    expect(screen.getByTitle(item.description)).toHaveAttribute('tabindex', '0')
    expect(screen.getByText('AC-102 — Điều hòa')).toBeInTheDocument()
    expect(screen.getByText('Có')).toBeInTheDocument()
  })
  it.each([
    ['ASSIGNED', 'Đã giao'],
    ['IN_PROGRESS', 'Đang xử lý'],
    ['COMPLETED', 'Hoàn thành'],
    ['NO_ACTION', 'Chỉ ghi nhận'],
    [null, 'Không xác định'],
  ] as const)('shows status %s using text', async (status, label) => {
    vi.mocked(api.get).mockResolvedValue(page([{ ...item, status }]))
    renderPage()
    await screen.findByRole('table')
    expect(screen.getByText(label, { selector: 'span' })).toBeInTheDocument()
  })
  it('shows pending, error/retry and distinct empty/filter-empty states', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { message: 'Không đọc được lịch sử' } },
      })
      .mockResolvedValue(page([]))
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải lịch sử bảo trì')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không đọc được lịch sử')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByText('Chưa có lịch sử bảo trì trong phạm vi của bạn.'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tìm kiếm lịch sử'), { target: { value: 'không có' } })
    expect(await screen.findByText('Không có kết quả khớp bộ lọc.')).toBeInTheDocument()
  })
  it('debounces literal search, filters dates/status/sort and paginates with correct API parameters', async () => {
    vi.mocked(api.get).mockResolvedValue(page([item], 25))
    renderPage()
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Tìm kiếm lịch sử'), { target: { value: ' AC.*[x] ' } })
    expect(api.get).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/maintenance/history', {
        params: expect.objectContaining({ q: 'AC.*[x]', page: 1, limit: 10, sort: 'desc' }),
      }),
    )
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'COMPLETED' } })
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '25/10/2026' } })
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '26/10/2026' } })
    fireEvent.change(screen.getByLabelText('Thứ tự báo cáo'), { target: { value: 'asc' } })
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/maintenance/history', {
        params: expect.objectContaining({
          from: '2026-10-25',
          to: '2026-10-26',
          status: 'COMPLETED',
          sort: 'asc',
          q: 'AC.*[x]',
          page: 1,
        }),
      }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/maintenance/history', {
        params: expect.objectContaining({ page: 2, status: 'COMPLETED' }),
      }),
    )
  })
  it('blocks invalid date ranges before requesting data, then allows correction', async () => {
    renderPage(`${root}?from=2026-10-26&to=2026-10-25`)
    expect(screen.getByRole('alert')).toHaveTextContent('Ngày từ phải trước hoặc bằng ngày đến')
    expect(api.get).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '31/02/2026' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Nhập ngày hợp lệ')
    expect(api.get).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '25/10/2026' } })
    await screen.findByRole('table')
    expect(api.get).toHaveBeenCalledTimes(1)
  })
  it('keeps URL filters and page after opening a detail and returning, with no edit controls', async () => {
    vi.mocked(api.get).mockImplementation(async (url) =>
      url === '/maintenance/history/record1' ? { data: detail } : page([item], 25),
    )
    const { router } = renderPage(`${root}?q=điều&status=COMPLETED&from=2026-10-25&page=2`)
    fireEvent.click(await screen.findByRole('link', { name: /Xem bản ghi/ }))
    expect(await screen.findByText('Bản ghi lịch sử, chỉ xem')).toBeInTheDocument()
    expect(screen.getByText(detail.task!.workResult!)).toBeInTheDocument()
    expect(screen.getByText('Người thực hiện', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('Người báo')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: /sửa|xóa|hoàn thành|giao lại/i }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Quay lại danh sách' }))
    await screen.findByRole('table')
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('2')
    expect(screen.getByLabelText('Tìm kiếm lịch sử')).toHaveValue('điều')
    expect(screen.getByLabelText('Từ ngày')).toHaveValue('25/10/2026')
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('COMPLETED')
  })
  it('supports direct detail links, no-action/orphan records and missing targets', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...detail,
        status: null,
        task: null,
        target: { room: null, equipment: null, facilityLocation: null },
      },
    })
    renderPage(`${root}/record1`)
    expect(
      await screen.findByText('Không xác định được công việc liên kết. Bản ghi vẫn chỉ xem.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Đối tượng không còn tồn tại')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Công việc bảo trì' })).not.toBeInTheDocument()
  })
  it('shows a scoped 404 with a list link', async () => {
    vi.mocked(api.get).mockRejectedValue(
      Object.assign(new Error('Missing history fixture'), {
        isAxiosError: true,
        response: { status: 404, data: { message: 'Missing' } },
      }),
    )
    renderPage(`${root}/hidden`)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không tìm thấy bản ghi hoặc nằm ngoài phạm vi của bạn',
    )
    expect(screen.getByRole('link', { name: 'Quay lại danh sách' })).toHaveAttribute('href', root)
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument()
  })
  it('allows retrying a detail request failure without write calls', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 503, data: { message: 'Lỗi đọc' } },
      })
      .mockResolvedValue({ data: detail })
    const post = vi.spyOn(api, 'post')
    const patch = vi.spyOn(api, 'patch')
    renderPage(`${root}/record1`)
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải bản ghi')
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByText('Bản ghi lịch sử, chỉ xem')
    expect(post).not.toHaveBeenCalled()
    expect(patch).not.toHaveBeenCalled()
  })
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'MANAGER'])(
    'blocks %s even with issue permission on list/detail',
    async (role) => {
      const first = renderPage(root, role)
      await screen.findByText('Không có quyền truy cập')
      first.unmount()
      renderPage(`${root}/record1`, role)
      await screen.findByText('Không có quyền truy cập')
      expect(api.get).not.toHaveBeenCalled()
    },
  )
  it('redirects anonymous actors and exposes the menu only for operations', async () => {
    const first = renderWithAuth(
      [...maintenanceRoutes, { path: '/login', element: <p>Đăng nhập test</p> }],
      { path: root },
    )
    await screen.findByText('Đăng nhập test')
    expect(api.get).not.toHaveBeenCalled()
    first.unmount()
    const second = renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: { ...ME, role: 'OPERATIONS_STAFF' }, status: 'authenticated' },
    })
    expect(screen.getByRole('link', { name: 'Lịch sử bảo trì' })).toHaveAttribute('href', root)
    second.unmount()
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: { ...ME, role: 'MANAGER' }, status: 'authenticated' },
    })
    expect(screen.queryByRole('link', { name: 'Lịch sử bảo trì' })).not.toBeInTheDocument()
  })
})
