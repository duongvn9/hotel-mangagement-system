import { configure, fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { maintenanceRoutes } from './routes'
import type { MaintenanceTargets } from './api'

const targets: MaintenanceTargets = {
  rooms: [{ id: 'room1', roomNumber: '102', floor: 1, status: 'AVAILABLE' }],
  equipment: [
    {
      id: 'device1',
      assetCode: 'AC-102',
      name: 'Điều hòa',
      category: 'Điện',
      location: 'Phòng 102',
      roomId: 'room1',
      roomNumber: '102',
    },
    {
      id: 'device2',
      assetCode: 'LIFT',
      name: 'Thang máy',
      category: 'Cơ sở',
      location: 'Sảnh',
      roomId: null,
      roomNumber: null,
    },
  ],
}
function renderPage(role = 'OPERATIONS_STAFF', permissions: string[] = []) {
  return renderWithAuth(
    [...maintenanceRoutes, { path: '/login', element: <p>Đăng nhập test</p> }],
    {
      path: '/operations/maintenance/report',
      auth: { me: { ...ME, role, permissions }, status: 'authenticated' },
    },
  )
}
async function fill() {
  await screen.findByRole('option', { name: 'Phòng 102 — tầng 1' })
  fireEvent.change(screen.getByLabelText(/Phòng bị ảnh hưởng/), { target: { value: 'room1' } })
  fireEvent.change(screen.getByLabelText(/Mô tả lỗi/), { target: { value: 'Điều hòa bị rò điện' } })
}
describe('UC35 ReportFaultPage', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  beforeEach(() => vi.spyOn(api, 'get').mockResolvedValue({ data: targets }))
  afterEach(() => vi.restoreAllMocks())
  it('renders required fields, debounce, selected equipment room and safe-use action lock', async () => {
    const get = vi.mocked(api.get)
    renderPage()
    await screen.findByRole('option', { name: 'Phòng 102 — tầng 1' })
    expect(screen.getByLabelText('Cần xử lý/bảo trì')).toBeChecked()
    expect(screen.getByLabelText('Ngăn việc sử dụng phòng an toàn')).not.toBeChecked()
    fireEvent.change(screen.getByLabelText('Tìm phòng hoặc thiết bị'), {
      target: { value: ' AC.*[x] ' },
    })
    expect(get).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/maintenance/targets', { params: { q: 'AC.*[x]' } }),
    )
    fireEvent.change(screen.getByLabelText('Đối tượng bị ảnh hưởng'), {
      target: { value: 'EQUIPMENT' },
    })
    fireEvent.change(screen.getByLabelText(/Thiết bị bị ảnh hưởng/), {
      target: { value: 'device1' },
    })
    expect(screen.getByText('Phòng liên quan: 102')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Cần xử lý/bảo trì'))
    fireEvent.click(screen.getByLabelText('Ngăn việc sử dụng phòng an toàn'))
    expect(screen.getByLabelText('Cần xử lý/bảo trì')).toBeChecked()
    expect(screen.getByLabelText('Cần xử lý/bảo trì')).toBeDisabled()
    expect(screen.getByLabelText(/Mô tả lỗi/)).toHaveAttribute('maxlength', '2000')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
  it('validates targets and description, focuses first error and links errors with aria', async () => {
    const post = vi.spyOn(api, 'post')
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    expect(await screen.findByText('Chọn phòng hoặc thiết bị bị ảnh hưởng.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Phòng bị ảnh hưởng/)).toHaveFocus()
    expect(screen.getByLabelText(/Mô tả lỗi/)).toHaveAttribute(
      'aria-describedby',
      'description-count description-error',
    )
    expect(post).not.toHaveBeenCalled()
  })
  it('requires a facility location and rejects unsafe common equipment without a room', async () => {
    const post = vi.spyOn(api, 'post')
    renderPage()
    fireEvent.change(screen.getByLabelText('Đối tượng bị ảnh hưởng'), {
      target: { value: 'FACILITY' },
    })
    fireEvent.change(screen.getByLabelText(/Mô tả lỗi/), { target: { value: 'Lỗi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    expect(await screen.findByText('Nhập vị trí cơ sở, tối đa 200 ký tự.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Đối tượng bị ảnh hưởng'), {
      target: { value: 'EQUIPMENT' },
    })
    await screen.findByRole('option', { name: /LIFT — Thang máy/ })
    fireEvent.change(screen.getByLabelText(/Thiết bị bị ảnh hưởng/), {
      target: { value: 'device2' },
    })
    fireEvent.click(screen.getByLabelText('Ngăn việc sử dụng phòng an toàn'))
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    expect(
      await screen.findByText(
        'Cần chọn phòng hoặc thiết bị thuộc phòng để đánh dấu không khả dụng.',
      ),
    ).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })
  it('blocks double submit and posts only the specified data with a stable UUID request key', async () => {
    let resolve!: (value: unknown) => void
    const post = vi.spyOn(api, 'post').mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    renderPage()
    await fill()
    const button = screen.getByRole('button', { name: 'Gửi báo cáo' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled()
    expect(post).toHaveBeenCalledWith(
      '/maintenance/reports',
      {
        roomId: 'room1',
        description: 'Điều hòa bị rò điện',
        requiresAction: true,
        preventsSafeUse: false,
      },
      { headers: { 'Idempotency-Key': expect.stringMatching(/^[\da-f-]{36}$/) } },
    )
    resolve({
      data: { reportId: 'report1', taskId: 'task1', roomMarkedUnavailable: true, warnings: [] },
    })
    expect(await screen.findByText('Đã ghi nhận báo cáo bảo trì.')).toBeInTheDocument()
    expect(screen.queryByText('task1')).not.toBeInTheDocument()
    expect(screen.queryByText('report1')).not.toBeInTheDocument()
    expect(screen.queryByText('Mã báo cáo')).not.toBeInTheDocument()
    expect(screen.queryByText('Mã công việc bảo trì')).not.toBeInTheDocument()
    expect(screen.getByText('Phòng đã được đánh dấu bảo trì, không khả dụng.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem lịch sử bảo trì' })).toHaveAttribute(
      'href',
      '/operations/maintenance/history',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Báo cáo vấn đề khác' }))
    expect(screen.getByLabelText(/Mô tả lỗi/)).toHaveValue('')
  })
  it.each([
    {
      reportId: 'r',
      roomMarkedUnavailable: false,
      warnings: [],
      expected: 'Không yêu cầu tạo công việc bảo trì.',
    },
    {
      reportId: 'r',
      taskId: 't',
      roomMarkedUnavailable: false,
      warnings: ['Phòng đang có khách; cần lễ tân xử lý'],
      expected: 'Phòng đang có khách; cần lễ tân xử lý',
    },
  ])('shows truthful confirmation %j', async ({ expected, ...receipt }) => {
    vi.spyOn(api, 'post').mockResolvedValue({ data: receipt })
    renderPage()
    await fill()
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    expect(await screen.findByText(expected)).toBeInTheDocument()
  })
  it('keeps data and the same request key after partial/network failure, then resumes safely', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 503, data: { message: 'Báo cáo r đã lưu nhưng chưa hoàn tất' } },
      })
      .mockResolvedValue({
        data: { reportId: 'r', taskId: 't', roomMarkedUnavailable: false, warnings: [] },
      })
    renderPage()
    await fill()
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Báo cáo r đã lưu')
    expect(screen.getByLabelText(/Mô tả lỗi/)).toHaveValue('Điều hòa bị rò điện')
    expect(screen.getByLabelText(/Mô tả lỗi/)).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lại báo cáo' }))
    await screen.findByText('Đã ghi nhận báo cáo bảo trì.')
    expect(post.mock.calls[0]).toEqual(post.mock.calls[1])
  })
  it('maps server validation to fields and allows correcting input without losing it', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { message: 'description chưa hợp lệ' } },
    })
    renderPage()
    await fill()
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText(/Mô tả lỗi/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Mô tả lỗi/)).toBeEnabled()
    expect(screen.getByLabelText(/Mô tả lỗi/)).toHaveValue('Điều hòa bị rò điện')
  })
  it('submits a facility-only report without creating a maintenance task', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { reportId: 'facility-report', roomMarkedUnavailable: false, warnings: [] },
    })
    renderPage()
    fireEvent.change(screen.getByLabelText('Đối tượng bị ảnh hưởng'), {
      target: { value: 'FACILITY' },
    })
    fireEvent.change(screen.getByLabelText(/^Vị trí cơ sở/), {
      target: { value: '  Sảnh tầng 1  ' },
    })
    fireEvent.change(screen.getByLabelText(/Mô tả lỗi/), {
      target: { value: '  Đèn khu vực tiếp đón bị hỏng.  ' },
    })
    fireEvent.click(screen.getByLabelText('Cần xử lý/bảo trì'))
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    await screen.findByText('Đã ghi nhận báo cáo bảo trì.')
    expect(post).toHaveBeenCalledWith(
      '/maintenance/reports',
      {
        facilityLocation: 'Sảnh tầng 1',
        description: 'Đèn khu vực tiếp đón bị hỏng.',
        requiresAction: false,
        preventsSafeUse: false,
      },
      { headers: { 'Idempotency-Key': expect.any(String) } },
    )
    expect(screen.getByText('Không yêu cầu tạo công việc bảo trì.')).toBeInTheDocument()
    expect(screen.getByText('Báo cáo này chưa đánh dấu phòng không khả dụng.')).toBeInTheDocument()
  })
  it('retains selected equipment and its image across empty searches and submits only its ID', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        data: {
          ...targets,
          equipment: [{ ...targets.equipment[0], imageUrl: '/images/equipment/ac.jpg' }],
        },
      })
      .mockResolvedValue({ data: { rooms: [], equipment: [] } })
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        reportId: 'equipment-report',
        taskId: 'task',
        roomMarkedUnavailable: false,
        warnings: [],
      },
    })
    renderPage()
    await screen.findByRole('option', { name: 'Phòng 102 — tầng 1' })
    fireEvent.change(screen.getByLabelText('Đối tượng bị ảnh hưởng'), {
      target: { value: 'EQUIPMENT' },
    })
    await screen.findByRole('option', { name: /AC-102 — Điều hòa/ })
    fireEvent.change(screen.getByLabelText(/Thiết bị bị ảnh hưởng/), {
      target: { value: 'device1' },
    })
    expect(screen.getByRole('img', { name: 'Điều hòa' })).toHaveAttribute(
      'src',
      expect.stringContaining('/images/equipment/ac.jpg'),
    )
    fireEvent.change(screen.getByLabelText('Tìm phòng hoặc thiết bị'), {
      target: { value: 'không có kết quả' },
    })
    await screen.findByText('Không tìm thấy phòng/thiết bị phù hợp.')
    expect(screen.getByLabelText(/Thiết bị bị ảnh hưởng/)).toHaveValue('device1')
    expect(screen.getByRole('img', { name: 'Điều hòa' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Mô tả lỗi/), {
      target: { value: 'Điều hòa bị hỏng' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    await screen.findByText('Đã ghi nhận báo cáo bảo trì.')
    expect(post).toHaveBeenCalledWith(
      '/maintenance/reports',
      {
        equipmentId: 'device1',
        description: 'Điều hòa bị hỏng',
        requiresAction: true,
        preventsSafeUse: false,
      },
      { headers: { 'Idempotency-Key': expect.any(String) } },
    )
  })
  it('handles loading, failed/retried target search and empty results', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { message: 'Tìm kiếm lỗi' } },
      })
      .mockResolvedValue({ data: { rooms: [], equipment: [] } })
    renderPage()
    expect(screen.getByText('Đang tải đối tượng…')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Tìm kiếm lỗi')
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại tìm kiếm' }))
    expect(await screen.findByText('Không tìm thấy phòng/thiết bị phù hợp.')).toBeInTheDocument()
  })
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'MANAGER', 'CUSTOM'])(
    'blocks %s even with issue:report/issue:manage permissions',
    async (role) => {
      renderPage(role, ['issue:report', 'issue:manage'])
      expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument()
      expect(api.get).not.toHaveBeenCalled()
    },
  )
  it('redirects anonymous users without requests and exposes the menu only to operations', async () => {
    const first = renderWithAuth(
      [...maintenanceRoutes, { path: '/login', element: <p>Đăng nhập test</p> }],
      { path: '/operations/maintenance/report' },
    )
    expect(await screen.findByText('Đăng nhập test')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
    first.unmount()
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: { ...ME, role: 'OPERATIONS_STAFF' }, status: 'authenticated' },
    })
    expect(screen.getByRole('link', { name: 'Báo hỏng hóc' })).toHaveAttribute(
      'href',
      '/operations/maintenance/report',
    )
  })
})
