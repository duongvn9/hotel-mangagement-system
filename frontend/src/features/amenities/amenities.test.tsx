import { fireEvent, screen, waitFor, within, configure } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { amenityRoutes } from './routes'
import type { Amenity } from './api'
const description = 'Mô tả đầy đủ của tiện nghi, có thể xem bằng bàn phím khi nội dung bị rút gọn.'
const types = Array.from({ length: 5 }, (_, index) => ({
  id: 't' + index,
  name: 'Type ' + index,
  isActive: index !== 1,
}))
const items: Amenity[] = [
  { id: 'a1', name: 'Wi-Fi', description, isActive: true, roomTypes: types, roomTypeCount: 5 },
  { id: 'a2', name: 'Old', description: '', isActive: false, roomTypes: [], roomTypeCount: 0 },
]
const response = (rows = items, total = rows.length) => ({
  data: { items: rows, total, page: 1, limit: 10 },
})
function renderPage(role = 'MANAGER', permissions: string[] = []) {
  return renderWithAuth([...amenityRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
    path: '/manager/amenities',
    auth: { me: { ...ME, role, permissions }, status: 'authenticated' },
  })
}
describe('UC51 AmenitiesPage', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  afterEach(() => vi.restoreAllMocks())
  it('renders columns, inactive labels, reverse type chips, accessible descriptions and management actions', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response())
    renderPage()
    const table = await screen.findByRole('table', { name: 'Danh sách tiện nghi' })
    for (const name of ['Tên', 'Mô tả', 'Gắn vào Room Type', 'Số loại phòng', 'Trạng thái'])
      expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument()
    expect(within(table).getByText('Type 1 (ngừng)')).toBeInTheDocument()
    expect(within(table).getByText('Ngừng')).toBeInTheDocument()
    expect(within(table).getByText('Đang hoạt động')).toBeInTheDocument()
    expect(screen.getByText('Chưa gắn Room Type nào')).toBeInTheDocument()
    expect(screen.getByText('Chưa có mô tả')).toBeInTheDocument()
    const tooltip = screen.getByTitle(description)
    expect(tooltip).toHaveClass('truncate')
    expect(tooltip).toHaveAttribute('tabindex', '0')
    expect(tooltip).toHaveAccessibleName(description)
    const more = screen.getByText('+2 loại phòng')
    expect(more).toHaveClass('min-h-11')
    fireEvent.click(more)
    await waitFor(() => expect(more.closest('details')).toHaveAttribute('open'))
    expect(screen.getByText('Type 4')).toBeVisible()
    expect(within(table).getByRole('cell', { name: '5' })).toHaveClass('text-right')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Thêm tiện nghi' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Sửa tiện nghi Wi-Fi' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Xóa/ })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Danh sách tiện nghi/ })).toHaveClass(
      'overflow-x-auto',
    )
  })
  it('shows loading', () => {
    vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Đang tải tiện nghi…')).toBeInTheDocument()
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
    expect(await screen.findByRole('rowheader', { name: 'Wi-Fi' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('distinguishes empty catalog and empty search, debounces and sends literal search', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(response([]))
    renderPage()
    expect(await screen.findByText('Chưa có tiện nghi nào.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tìm theo tên'), { target: { value: ' Wi.*[x] ' } })
    expect(get).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Không có kết quả khớp bộ lọc.')).toBeInTheDocument()
    expect(get).toHaveBeenLastCalledWith('/amenities', {
      params: { page: 1, limit: 10, search: 'Wi.*[x]' },
    })
  })
  it('preserves search/activity filters across pagination and resets page on filter changes', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(response(items, 21))
    renderPage()
    await screen.findByRole('rowheader', { name: 'Wi-Fi' })
    fireEvent.change(screen.getByLabelText('Tìm theo tên'), { target: { value: 'Wi' } })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/amenities', {
        params: { page: 1, limit: 10, search: 'Wi' },
      }),
    )
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'false' } })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/amenities', {
        params: { page: 1, limit: 10, search: 'Wi', isActive: false },
      }),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/amenities', {
        params: { page: 2, limit: 10, search: 'Wi', isActive: false },
      }),
    )
    await screen.findByRole('rowheader', { name: 'Wi-Fi' })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: '' } })
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/amenities', {
        params: { page: 1, limit: 10, search: 'Wi', isActive: undefined },
      }),
    )
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
    expect(await screen.findByRole('rowheader', { name: 'Wi-Fi' })).toBeInTheDocument()
  })
  it('redirects anonymous users to login', async () => {
    const get = vi.spyOn(api, 'get')
    renderWithAuth([...amenityRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
      path: '/manager/amenities',
    })
    expect(await screen.findByText('Đăng nhập test')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })
  it('adds Tiện nghi to the Manager menu', () => {
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: ME, status: 'authenticated' },
    })
    expect(screen.getByRole('link', { name: 'Tiện nghi' })).toHaveAttribute(
      'href',
      '/manager/amenities',
    )
  })
})
