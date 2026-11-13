import { fireEvent, screen, waitFor, within, configure } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { bedTypeRoutes } from './routes'
import type { BedType } from './api'

const description =
  'Mô tả đầy đủ của loại giường, có thể xem bằng bàn phím khi nội dung bị rút gọn.'
const types = Array.from({ length: 5 }, (_, index) => ({
  id: 't' + index,
  name: 'Type ' + index,
  isActive: index !== 1,
}))
const items: BedType[] = [
  { id: 'b1', name: 'Giường đôi', description, isActive: true, roomTypes: types, roomTypeCount: 5 },
  { id: 'b2', name: 'Cũ', description: '', isActive: false, roomTypes: [], roomTypeCount: 0 },
]
const response = (rows = items, total = rows.length) => ({
  data: { items: rows, total, page: 1, limit: 10 },
})
function renderPage(role = 'MANAGER', permissions: string[] = []) {
  return renderWithAuth([...bedTypeRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
    path: '/manager/bed-types',
    auth: { me: { ...ME, role, permissions }, status: 'authenticated' },
  })
}
describe('BedTypesPage', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  afterEach(() => vi.restoreAllMocks())
  it('renders columns, inactive labels, room-type chips, accessible descriptions and actions', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response())
    renderPage()
    await screen.findByRole('rowheader', { name: 'Giường đôi' })
    const table = await screen.findByRole('table', { name: 'Danh sách loại giường' })
    for (const name of ['Tên', 'Mô tả', 'Dùng ở loại phòng', 'Số loại phòng', 'Trạng thái'])
      expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument()
    expect(within(table).getByText('Type 1 (ngừng)')).toBeInTheDocument()
    expect(within(table).getByText('Ngừng')).toBeInTheDocument()
    expect(within(table).getByText('Đang hoạt động')).toBeInTheDocument()
    expect(screen.getByText('Chưa có loại phòng nào')).toBeInTheDocument()
    expect(screen.getByText('Chưa có mô tả')).toBeInTheDocument()
    const tooltip = screen.getByTitle(description)
    expect(tooltip).toHaveClass('truncate')
    expect(tooltip).toHaveAttribute('tabindex', '0')
    const more = screen.getByText('+2 loại phòng')
    fireEvent.click(more)
    await waitFor(() => expect(more.closest('details')).toHaveAttribute('open'))
    expect(screen.getByText('Type 4')).toBeVisible()
    expect(within(table).getByRole('cell', { name: '5' })).toHaveClass('text-right')
    expect(screen.getByRole('button', { name: 'Thêm loại giường' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Sửa loại giường Giường đôi' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Xóa/ })).not.toBeInTheDocument()
  })
  it('shows backend errors and retries the same API', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { message: 'Không tải được danh sách' } },
      })
      .mockResolvedValue(response())
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh sách')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('rowheader', { name: 'Giường đôi' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('distinguishes empty catalog and empty search, debounces and sends literal search', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(response([]))
    renderPage()
    expect(await screen.findByText('Chưa có loại giường nào.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tìm theo tên'), { target: { value: ' Gi.*[x] ' } })
    expect(get).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Không có kết quả khớp bộ lọc.')).toBeInTheDocument()
    expect(get).toHaveBeenLastCalledWith('/bed-types', {
      params: { page: 1, limit: 10, search: 'Gi.*[x]' },
    })
  })
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'blocks %s without API requests',
    async (role) => {
      const get = vi.spyOn(api, 'get')
      renderPage(role)
      expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument()
      expect(get).not.toHaveBeenCalled()
    },
  )
  it('supports a custom role with facility permission', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response())
    renderPage('CUSTOM', ['facility:manage'])
    expect(await screen.findByRole('rowheader', { name: 'Giường đôi' })).toBeInTheDocument()
  })
  it('redirects anonymous users to login', async () => {
    const get = vi.spyOn(api, 'get')
    renderWithAuth([...bedTypeRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
      path: '/manager/bed-types',
    })
    expect(await screen.findByText('Đăng nhập test')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })
  it('adds Loại giường to the Manager menu', () => {
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: ME, status: 'authenticated' },
    })
    expect(screen.getByRole('link', { name: 'Loại giường' })).toHaveAttribute(
      'href',
      '/manager/bed-types',
    )
  })
})
