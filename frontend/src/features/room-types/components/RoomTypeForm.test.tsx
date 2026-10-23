import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { roomTypeRoutes } from '../routes'
import { RoomTypeForm } from './RoomTypeForm'

const room = {
  id: 'abcdef0123456789abcdef01',
  name: 'Standard',
  description: 'Hai khách',
  adultCapacity: 2,
  childCapacity: 0,
  basePrice: 850000,
  amenities: [{ id: 'abcdef0123456789abcdef02', name: 'Wi-Fi', isActive: false }],
  isActive: true,
  availableForBooking: true,
}
function renderForm(initial?: typeof room) {
  const success = vi.fn()
  const close = vi.fn()
  renderWithAuth(
    [
      {
        path: '/',
        element: <RoomTypeForm initial={initial} onClose={close} onSuccess={success} />,
      },
    ],
    { auth: { me: ME, status: 'authenticated' } },
  )
  return { success, close }
}
function fill() {
  fireEvent.change(screen.getByLabelText(/Tên loại phòng/), { target: { value: 'Deluxe' } })
  fireEvent.change(screen.getByLabelText(/Người lớn/), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText(/Trẻ em/), { target: { value: '0' } })
  fireEvent.change(screen.getByLabelText(/Giá VND/), { target: { value: '1.500.000' } })
}
describe('UC50 form', () => {
  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [] })
  })
  afterEach(() => vi.restoreAllMocks())
  it('validates fields, links error messages and focuses first error', async () => {
    const post = vi.spyOn(api, 'post')
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại phòng' }))
    expect(screen.getByLabelText(/Tên loại phòng/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Người lớn/)).toHaveAccessibleDescription(
      'Số người lớn phải là số nguyên từ 1.',
    )
    expect(screen.getByLabelText(/Trẻ em/)).toHaveAccessibleDescription(
      'Số trẻ em phải là số nguyên từ 0.',
    )
    expect(screen.getByLabelText(/Giá VND/)).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(screen.getByLabelText(/Tên loại phòng/)).toHaveFocus())
    expect(post).not.toHaveBeenCalled()
  })
  it.each([
    ['Người lớn', '0'],
    ['Người lớn', '-1'],
    ['Người lớn', '1.5'],
    ['Người lớn', ''],
    ['Trẻ em', '-1'],
    ['Trẻ em', '1.5'],
    ['Trẻ em', ''],
  ])('rejects invalid %s value %s on the client', async (label, value) => {
    const post = vi.spyOn(api, 'post')
    renderForm()
    fill()
    const input = screen.getByLabelText(new RegExp(label))
    fireEvent.change(input, { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại phòng' }))
    expect(input).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(input).toHaveFocus())
    expect(post).not.toHaveBeenCalled()
  })
  it('submits integer VND, prevents double submit while pending, and succeeds', async () => {
    let finish!: (value: unknown) => void
    const post = vi.spyOn(api, 'post').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { success } = renderForm()
    fill()
    const button = screen.getByRole('button', { name: 'Lưu loại phòng' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post).toHaveBeenCalledWith(
      '/room-types',
      expect.objectContaining({
        basePrice: 1500000,
        adultCapacity: 3,
        childCapacity: 0,
        amenities: [],
      }),
    )
    expect(post.mock.calls[0][1]).not.toHaveProperty('capacity')
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled()
    finish({ data: room })
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
  })
  it.each([
    [409, 'Tên loại phòng đã tồn tại', /Tên loại phòng/],
    [400, 'amenities không hợp lệ: abc', 'Tiện nghi'],
    [400, 'adultCapacity must not be less than 1', /Người lớn/],
    [400, 'childCapacity must not be less than 0', /Trẻ em/],
  ])('maps API error %s to its field and retains input', async (status, message, label) => {
    vi.spyOn(api, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status, data: { message } },
    })
    renderForm()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại phòng' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(
      label === 'Tiện nghi'
        ? screen.getByRole('group', { name: 'Tiện nghi' })
        : screen.getByLabelText(label),
    ).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Tên loại phòng/)).toHaveValue('Deluxe')
  })
  it('loads existing fields, retains inactive amenities and sends only changed fields', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: room })
    renderForm(room)
    expect(screen.getByLabelText('Wi-Fi (ngừng)')).toBeChecked()
    expect(screen.getByLabelText(/Giá VND/)).toHaveValue('850.000')
    expect(screen.getByLabelText(/Người lớn/)).toHaveValue(2)
    expect(screen.getByLabelText(/Trẻ em/)).toHaveValue(0)
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại phòng' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/room-types/${room.id}`, { description: 'Mới' }),
    )
  })
  it('requires confirmation before deactivating', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: room })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderForm(room)
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng nhận đặt phòng' }))
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('booking đang hoạt động vẫn hợp lệ'),
    )
    expect(patch).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng nhận đặt phòng' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/room-types/${room.id}`, { isActive: false }),
    )
  })
  it('shows amenity loading, empty and error states with retry', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(api.get).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    renderForm()
    expect(screen.getByText('Đang tải tiện nghi…')).toBeInTheDocument()
    finish({ data: [] })
    expect(await screen.findByText('Chưa có tiện nghi nào')).toBeInTheDocument()
  })
  it('shows amenity request errors', async () => {
    vi.mocked(api.get).mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Không tải được tiện nghi' } },
    })
    renderForm()
    expect(await screen.findByText('Không tải được tiện nghi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại tiện nghi' })).toBeInTheDocument()
  })
  it('opens create/edit dialogs, handles Esc and refreshes list while keeping filters', async () => {
    // jsdom does not implement native dialog methods; browser behavior is checked separately.
    if (!HTMLDialogElement.prototype.showModal)
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
        configurable: true,
        value() {},
      })
    if (!HTMLDialogElement.prototype.close)
      Object.defineProperty(HTMLDialogElement.prototype, 'close', {
        configurable: true,
        value() {},
      })
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute('open', '')
    })
    vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute('open')
    })
    const get = vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/amenities/options') return { data: [] }
      if (url === `/room-types/${room.id}`) return { data: room }
      return { data: { items: [room], total: 21, page: 1, limit: 10 } }
    })
    vi.spyOn(api, 'patch').mockResolvedValue({ data: room })
    renderWithAuth(roomTypeRoutes, {
      path: '/manager/room-types',
      auth: { me: ME, status: 'authenticated' },
    })
    await screen.findByRole('rowheader', { name: 'Standard' })
    fireEvent.change(screen.getByLabelText('Tìm theo tên'), { target: { value: 'Standard' } })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/room-types', {
        params: expect.objectContaining({ search: 'Standard' }),
      }),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/room-types', {
        params: expect.objectContaining({ page: 2 }),
      }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa Standard' }))
    expect(await screen.findByLabelText('Mô tả')).toHaveValue('Hai khách')
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại phòng' }))
    expect(
      await screen.findByText('Đã lưu loại phòng. Danh sách đã được cập nhật.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Tìm theo tên')).toHaveValue('Standard')
    expect(screen.getByText(/Trang 2\/3/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm loại phòng' }))
    expect(screen.getByLabelText(/Tên loại phòng/)).toHaveValue('')
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
