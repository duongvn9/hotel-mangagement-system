import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { roomRoutes } from './routes'
import { roomTypeOptions, type Room } from './api'
import * as roomApi from './api'

const note =
  'Ghi chú đầy đủ cho phòng, cần hiển thị nội dung này bằng nhãn hoặc tooltip khi bị rút gọn.'
const types = [
  { id: 'type1', name: 'Standard', isActive: true },
  { id: 'type2', name: 'Suite', isActive: false },
]
const rooms: Room[] = [
  {
    id: 'r1',
    roomNumber: '20',
    floor: 0,
    roomType: types[0],
    status: 'AVAILABLE',
    notes: note,
    isActive: true,
  },
  {
    id: 'r2',
    roomNumber: '101',
    floor: 1,
    roomType: types[1],
    status: 'OCCUPIED',
    notes: '',
    isActive: false,
  },
  {
    id: 'r3',
    roomNumber: '1010',
    floor: 2,
    roomType: types[0],
    status: 'CLEANING',
    notes: '',
    isActive: true,
  },
  {
    id: 'r4',
    roomNumber: '1020',
    floor: 2,
    roomType: null,
    status: 'MAINTENANCE',
    notes: '',
    isActive: true,
  },
]
const response = (items = rooms, total = items.length) => ({
  data: { items, total, page: 1, limit: 10 },
})
const typeResponse = () => ({ data: { items: types, total: types.length, page: 1, limit: 100 } })
function mockApi(items = rooms, total = items.length) {
  return vi
    .spyOn(api, 'get')
    .mockImplementation(async (url) =>
      url === '/room-types' ? typeResponse() : response(items, total),
    )
}
function renderPage(role = 'MANAGER', permissions: string[] = []) {
  return renderWithAuth([...roomRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
    path: '/manager/rooms',
    auth: { me: { ...ME, role, permissions }, status: 'authenticated' },
  })
}

describe('UC47 RoomsPage', () => {
  beforeEach(() =>
    vi
      .spyOn(roomApi, 'activeRoomTypeOptions')
      .mockResolvedValue([{ id: 'type1', name: 'Standard' }]),
  )
  afterEach(() => vi.restoreAllMocks())
  it('shows all columns, Vietnamese statuses, inactive room/type and missing reference safely', async () => {
    mockApi()
    renderPage()
    const table = await screen.findByRole('table', { name: 'Danh sách phòng' })
    for (const name of [
      'Số phòng',
      'Tầng',
      'Loại phòng',
      'Trạng thái vận hành',
      'Ghi chú',
      'Hoạt động',
    ])
      expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument()
    for (const name of [
      'Trống',
      'Có khách',
      'Đang dọn',
      'Bảo trì',
      'Ngừng',
      'Loại phòng ngừng',
      'Không tìm thấy loại phòng',
    ])
      expect(within(table).getByText(name)).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: '0' })).toBeInTheDocument()
    expect(screen.getByTitle(note)).toHaveClass('truncate')
    expect(screen.getByTitle(note)).toHaveAttribute('tabindex', '0')
    expect(screen.getByTitle(note)).toHaveAccessibleName(note)
    expect(screen.getByRole('option', { name: 'Suite (ngừng)' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Thêm phòng' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: /^Sửa phòng/ })).toHaveLength(4)
  })
  it('shows loading while rooms are pending independently from type options', () => {
    vi.spyOn(api, 'get').mockImplementation((url) =>
      url === '/room-types' ? Promise.resolve(typeResponse()) : new Promise(() => {}),
    )
    renderPage()
    expect(screen.getByText('Đang tải phòng…')).toBeInTheDocument()
  })
  it('shows request errors and explicitly retries rooms', async () => {
    let failures = 1
    const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/room-types') return typeResponse()
      if (failures-- > 0) throw new Error('offline')
      return response()
    })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('rowheader', { name: '20' })).toBeInTheDocument()
    expect(get.mock.calls.filter((call) => call[0] === '/rooms')).toHaveLength(2)
  })
  it('distinguishes an empty catalog from filtered no matches and debounces search', async () => {
    const get = mockApi([])
    renderPage()
    expect(await screen.findByText('Chưa có phòng nào.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tìm theo số phòng'), { target: { value: '10.*' } })
    expect(get.mock.calls.filter((call) => call[0] === '/rooms')).toHaveLength(1)
    expect(await screen.findByText('Không có kết quả khớp bộ lọc.')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/rooms', { params: { page: 1, limit: 10, search: '10.*' } })
  })
  it('sends type/status/activity filters and keeps them while paging; search resets the page', async () => {
    const get = mockApi(rooms, 21)
    renderPage()
    await screen.findByRole('option', { name: 'Suite (ngừng)' })
    fireEvent.change(screen.getByLabelText('Loại phòng'), { target: { value: 'type2' } })
    fireEvent.change(screen.getByLabelText('Trạng thái vận hành'), {
      target: { value: 'CLEANING' },
    })
    fireEvent.change(screen.getByLabelText('Hoạt động'), { target: { value: 'false' } })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/rooms', {
        params: { page: 1, limit: 10, roomTypeId: 'type2', status: 'CLEANING', isActive: false },
      }),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/rooms', {
        params: { page: 2, limit: 10, roomTypeId: 'type2', status: 'CLEANING', isActive: false },
      }),
    )
    fireEvent.change(screen.getByLabelText('Tìm theo số phòng'), { target: { value: '101' } })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/rooms', {
        params: {
          page: 1,
          limit: 10,
          roomTypeId: 'type2',
          status: 'CLEANING',
          isActive: false,
          search: '101',
        },
      }),
    )
  })
  it('keeps the table and other filters usable when type options fail, and offers recovery', async () => {
    let failTypes = true
    const get = vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/room-types') {
        if (failTypes) throw new Error('types offline')
        return typeResponse()
      }
      return response()
    })
    renderPage()
    expect(await screen.findByText(/Không tải được bộ lọc loại phòng/)).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: '20' })).toBeInTheDocument()
    expect(screen.getByLabelText('Loại phòng')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Trạng thái vận hành'), {
      target: { value: 'AVAILABLE' },
    })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/rooms', {
        params: { page: 1, limit: 10, status: 'AVAILABLE' },
      }),
    )
    failTypes = false
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại loại phòng' }))
    expect(await screen.findByRole('option', { name: 'Suite (ngừng)' })).toBeInTheDocument()
  })
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'blocks %s without any API reads',
    async (role) => {
      const get = vi.spyOn(api, 'get')
      renderPage(role)
      expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument()
      expect(get).not.toHaveBeenCalled()
    },
  )
  it('permits a custom role with facility permission', async () => {
    mockApi()
    renderPage('CUSTOM', ['facility:manage'])
    expect(await screen.findByRole('rowheader', { name: '20' })).toBeInTheDocument()
  })
  it('adds the Phòng manager menu link', () => {
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: ME, status: 'authenticated' },
    })
    expect(screen.getByRole('link', { name: 'Phòng' })).toHaveAttribute('href', '/manager/rooms')
  })
  it('loads all pages for the RoomType filter including inactive types', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { items: [types[0]], total: 101, page: 1, limit: 100 } })
      .mockResolvedValueOnce({ data: { items: [types[1]], total: 101, page: 2, limit: 100 } })
    expect(await roomTypeOptions()).toEqual(types)
    expect(get).toHaveBeenNthCalledWith(2, '/room-types', { params: { page: 2, limit: 100 } })
  })
})
