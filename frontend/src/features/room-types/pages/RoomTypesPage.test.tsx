import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { roomTypeRoutes } from '../routes'
import { UserMenu } from '@/features/auth/UserMenu'

const room = {
  id: 'r1',
  name: 'Standard',
  description: 'Phòng hai khách',
  capacity: 2,
  basePrice: 850000,
  amenities: [{ id: 'a1', name: 'Wi-Fi' }],
  isActive: true,
  availableForBooking: true,
}
const response = (items = [room], total = items.length) => ({
  data: { items, total, page: 1, limit: 10 },
})
function renderPage(role = 'MANAGER', permissions: string[] = []) {
  return renderWithAuth([...roomTypeRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
    path: '/manager/room-types',
    auth: { me: { ...ME, role, permissions }, status: 'authenticated' },
  })
}
describe('UC49 RoomTypesPage', () => {
  afterEach(() => vi.restoreAllMocks())
  it('renders columns, VND prices, amenities and availability', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response())
    renderPage()
    expect(await screen.findByRole('rowheader', { name: 'Standard' })).toBeInTheDocument()
    for (const name of ['Tên', 'Mô tả', 'Sức chứa', 'Giá', 'Tiện nghi', 'Trạng thái'])
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /850\.000\s*₫/ })).toBeInTheDocument()
    expect(screen.getByText('Wi-Fi')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Thêm loại phòng' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sửa Standard' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xóa/ })).not.toBeInTheDocument()
  })
  it('shows loading until API resolves', () => {
    vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải')
  })
  it('shows error then retries against the API', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(response())
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Standard')).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('distinguishes unfiltered empty and no matching results; debounces name search', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(response([]))
    renderPage()
    expect(await screen.findByText('Chưa có dữ liệu loại phòng.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tìm theo tên'), { target: { value: 'Deluxe' } })
    expect(get).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Không có loại phòng khớp bộ lọc.')).toBeInTheDocument()
    expect(get).toHaveBeenLastCalledWith('/room-types', {
      params: { page: 1, limit: 10, search: 'Deluxe' },
    })
  })
  it('filters status and preserves filters across pagination; resets page on search', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(response([room], 21))
    renderPage()
    await screen.findByText('Standard')
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'false' } })
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/room-types', {
        params: { page: 1, limit: 10, isActive: false },
      }),
    )
    const next = await screen.findByRole('button', { name: 'Trang sau' })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/room-types', {
        params: { page: 2, limit: 10, isActive: false },
      }),
    )
    fireEvent.change(screen.getByLabelText('Tìm theo tên'), { target: { value: 'Suite' } })
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/room-types', {
        params: { page: 1, limit: 10, isActive: false, search: 'Suite' },
      }),
    )
  })
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'denies %s without calling the API',
    (role) => {
      const get = vi.spyOn(api, 'get')
      renderPage(role)
      expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
      expect(get).not.toHaveBeenCalled()
    },
  )
  it('redirects anonymous visitors to login', async () => {
    const get = vi.spyOn(api, 'get')
    renderWithAuth([...roomTypeRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
      path: '/manager/room-types',
    })
    expect(await screen.findByText('Đăng nhập test')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })
  it('allows a custom role with facility:manage', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response())
    renderPage('FACILITY_ADMIN', ['facility:manage'])
    expect(await screen.findByText('Standard')).toBeInTheDocument()
  })
  it('manager menu links to room types', () => {
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: ME, status: 'authenticated' },
    })
    expect(screen.getByRole('link', { name: 'Loại phòng' })).toHaveAttribute(
      'href',
      '/manager/room-types',
    )
  })
})
