import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { serviceRoutes } from './routes'
import type { Service } from './api'

const description =
  'Mô tả đầy đủ của dịch vụ, có thể đọc khi nội dung được rút gọn trên điện thoại.'
const items: Service[] = [
  {
    id: 'a',
    name: 'Giặt ủi',
    description,
    unit: 'lần',
    billable: true,
    price: 50000,
    isActive: true,
  },
  {
    id: 'b',
    name: 'Đón tiếp',
    description: '',
    unit: '',
    billable: true,
    price: 0,
    isActive: true,
  },
  {
    id: 'c',
    name: 'Hướng dẫn',
    description: '',
    unit: '',
    billable: false,
    price: null,
    isActive: true,
  },
  {
    id: 'd',
    name: 'Spa',
    description: '',
    unit: 'lượt',
    billable: true,
    price: null,
    isActive: false,
  },
]
const response = (rows = items, total = rows.length) => ({
  data: { items: rows, total, page: 1, limit: 10 },
})
function renderPage(role = 'MANAGER', permissions: string[] = []) {
  return renderWithAuth([...serviceRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
    path: '/manager/services',
    auth: { me: { ...ME, role, permissions }, status: 'authenticated' },
  })
}
describe('UC53 ServicesPage', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  afterEach(() => vi.restoreAllMocks())
  it('renders columns, VND/unit, zero vs absent price, textual badges, accessible descriptions and management actions', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response())
    renderPage()
    const table = await screen.findByRole('table', { name: 'Danh sách dịch vụ' })
    for (const name of ['Tên', 'Mô tả', 'Tính phí', 'Giá', 'Trạng thái'])
      expect(within(table).getByRole('columnheader', { name })).toBeInTheDocument()
    const laundry = within(table).getByRole('rowheader', { name: 'Giặt ủi' }).closest('tr')!
    const zero = within(table).getByRole('rowheader', { name: 'Đón tiếp' }).closest('tr')!
    const free = within(table).getByRole('rowheader', { name: 'Hướng dẫn' }).closest('tr')!
    const draft = within(table).getByRole('rowheader', { name: 'Spa' }).closest('tr')!
    expect(within(laundry).getByRole('cell', { name: /50\.000\s*₫ \/ lần/ })).toHaveClass(
      'text-right',
    )
    expect(within(zero).getByRole('cell', { name: /^0\s*₫$/ })).toHaveClass('text-right')
    expect(within(zero).getByText('Tính phí')).toBeInTheDocument()
    expect(within(free).getByRole('cell', { name: '—' })).toBeInTheDocument()
    expect(within(free).getByText('Miễn phí')).toBeInTheDocument()
    expect(within(draft).getByRole('cell', { name: '— / lượt' })).toBeInTheDocument()
    expect(within(draft).getByText('Ngừng')).toBeInTheDocument()
    const tooltip = screen.getByTitle(description)
    expect(tooltip).toHaveClass('truncate')
    expect(tooltip).toHaveAttribute('tabindex', '0')
    expect(tooltip).toHaveAccessibleName(description)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Thêm dịch vụ' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Sửa dịch vụ Giặt ủi' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Xóa/ })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Danh sách dịch vụ/ })).toHaveClass('overflow-x-auto')
    expect(table).toHaveClass('min-w-[800px]')
    for (const label of ['Tìm theo tên', 'Tính phí', 'Trạng thái'])
      expect(screen.getByLabelText(label)).toHaveClass('h-11')
  })
  it('shows loading', () => {
    vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Đang tải dịch vụ…')).toBeInTheDocument()
  })
  it('shows backend errors and retries the same API', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { message: 'Không tải được dịch vụ' } },
      })
      .mockResolvedValue(response())
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được dịch vụ')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('rowheader', { name: 'Giặt ủi' })
    expect(get).toHaveBeenCalledTimes(2)
    expect(get.mock.calls[0]).toEqual(get.mock.calls[1])
  })
  it('distinguishes empty catalog/search, debounces and sends literal trimmed search', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(response([]))
    renderPage()
    await screen.findByText('Chưa có dịch vụ nào.')
    fireEvent.change(screen.getByLabelText('Tìm theo tên'), { target: { value: '  Giặt.*[x]  ' } })
    expect(get).toHaveBeenCalledTimes(1)
    await screen.findByText('Không có kết quả khớp bộ lọc.')
    expect(get).toHaveBeenLastCalledWith('/services', {
      params: { page: 1, limit: 10, search: 'Giặt.*[x]' },
    })
  })
  it('keeps both false filters and search across pagination; resets page when a filter changes', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(response(items, 21))
    renderPage()
    await screen.findByRole('rowheader', { name: 'Giặt ủi' })
    fireEvent.change(screen.getByLabelText('Tìm theo tên'), { target: { value: 'Spa' } })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/services', {
        params: { page: 1, limit: 10, search: 'Spa' },
      }),
    )
    fireEvent.change(screen.getByLabelText('Tính phí'), { target: { value: 'false' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'false' } })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/services', {
        params: { page: 1, limit: 10, search: 'Spa', billable: false, isActive: false },
      }),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/services', {
        params: { page: 2, limit: 10, search: 'Spa', billable: false, isActive: false },
      }),
    )
    await screen.findByRole('rowheader', { name: 'Giặt ủi' })
    expect(screen.getByLabelText('Tính phí')).toHaveValue('false')
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('false')
    fireEvent.change(screen.getByLabelText('Tính phí'), { target: { value: '' } })
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/services', {
        params: { page: 1, limit: 10, search: 'Spa', billable: undefined, isActive: false },
      }),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled())
  })
  it('distinguishes empty results when only a boolean filter is applied', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response([]))
    renderPage()
    await screen.findByText('Chưa có dịch vụ nào.')
    fireEvent.change(screen.getByLabelText('Tính phí'), { target: { value: 'true' } })
    await screen.findByText('Không có kết quả khớp bộ lọc.')
    fireEvent.change(screen.getByLabelText('Tính phí'), { target: { value: '' } })
    await screen.findByText('Chưa có dịch vụ nào.')
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'false' } })
    await screen.findByText('Không có kết quả khớp bộ lọc.')
  })
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'blocks %s without an API request',
    async (role) => {
      const get = vi.spyOn(api, 'get')
      renderPage(role)
      expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument()
      expect(get).not.toHaveBeenCalled()
    },
  )
  it('permits a custom role with facility:manage', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response())
    renderPage('CUSTOM', ['facility:manage'])
    expect(await screen.findByRole('rowheader', { name: 'Giặt ủi' })).toBeInTheDocument()
  })
  it('redirects an anonymous user to login without loading services', async () => {
    const get = vi.spyOn(api, 'get')
    renderWithAuth([...serviceRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
      path: '/manager/services',
    })
    expect(await screen.findByText('Đăng nhập test')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })
  it('adds Dịch vụ to the Manager menu', () => {
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: ME, status: 'authenticated' },
    })
    expect(screen.getByRole('link', { name: 'Dịch vụ' })).toHaveAttribute(
      'href',
      '/manager/services',
    )
  })
})
