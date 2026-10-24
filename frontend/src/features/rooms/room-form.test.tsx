import roomStatusSource from '../../../../backend/src/common/constants/room-status.enum.ts?raw'
import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { RoomForm } from './components/RoomForm'
import { roomRoutes } from './routes'
import { ROOM_STATUSES, ROOM_STATUS_DISPLAY, type Room } from './api'

const active = 'abcdef0123456789abcdef01'
const inactive = 'abcdef0123456789abcdef02'
const room: Room = {
  id: 'abcdef0123456789abcdef03',
  roomNumber: '101',
  floor: 0,
  roomType: { id: active, name: 'Standard', isActive: true },
  status: 'AVAILABLE',
  notes: 'Ghi chú cũ',
  isActive: true,
}
function form(initial?: Room) {
  const success = vi.fn()
  const close = vi.fn()
  renderWithAuth(
    [{ path: '/', element: <RoomForm initial={initial} onClose={close} onSuccess={success} /> }],
    { auth: { me: ME, status: 'authenticated' } },
  )
  return { success, close }
}
async function fill() {
  await screen.findByRole('option', { name: 'Standard' })
  fireEvent.change(screen.getByLabelText(/^Số phòng/), { target: { value: ' 201 ' } })
  fireEvent.change(screen.getByLabelText(/^Tầng/), { target: { value: '-1' } })
  fireEvent.change(screen.getByLabelText(/^Loại phòng của phòng/), { target: { value: active } })
}
function setupDialog() {
  for (const name of ['showModal', 'close'] as const)
    if (!HTMLDialogElement.prototype[name])
      Object.defineProperty(HTMLDialogElement.prototype, name, { configurable: true, value() {} })
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
}
describe('UC48 room form', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  beforeEach(() => {
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/room-types/options') return { data: [{ id: active, name: 'Standard' }] }
      if (url === '/room-types')
        return { data: { items: [room.roomType], total: 1, page: 1, limit: 100 } }
      if (url === `/rooms/${room.id}`) return { data: room }
      return { data: { items: [room], total: 21, page: 1, limit: 10 } }
    })
  })
  afterEach(() => vi.restoreAllMocks())
  it('keeps the four Vietnamese statuses exactly aligned with the existing backend enum', () => {
    expect(ROOM_STATUSES).toEqual(
      [...roomStatusSource.matchAll(/= '([^']+)'/g)].map((match) => match[1]),
    )
    expect(ROOM_STATUSES.map((status) => ROOM_STATUS_DISPLAY[status].label)).toEqual([
      'Trống',
      'Có khách',
      'Đang dọn',
      'Bảo trì',
    ])
  })
  it('validates required fields with accessible descriptions and focuses the first invalid control', async () => {
    const post = vi.spyOn(api, 'post')
    form()
    await screen.findByRole('option', { name: 'Standard' })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phòng' }))
    expect(screen.getByLabelText(/^Số phòng/)).toHaveAccessibleDescription('Nhập số phòng.')
    expect(screen.getByLabelText(/^Tầng/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/^Loại phòng của phòng/)).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(screen.getByLabelText(/^Số phòng/)).toHaveFocus())
    expect(post).not.toHaveBeenCalled()
  })
  it.each(['', '1.5', '9007199254740992'])(
    'rejects invalid floor %s without a request',
    async (value) => {
      const post = vi.spyOn(api, 'post')
      form()
      await fill()
      fireEvent.change(screen.getByLabelText(/^Tầng/), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: 'Lưu phòng' }))
      expect(screen.getByLabelText(/^Tầng/)).toHaveAccessibleDescription(
        'Tầng phải là số nguyên an toàn.',
      )
      await waitFor(() => expect(screen.getByLabelText(/^Tầng/)).toHaveFocus())
      expect(post).not.toHaveBeenCalled()
    },
  )
  it('submits trimmed data and defaults once while pending, then succeeds', async () => {
    let finish!: (value: unknown) => void
    const post = vi.spyOn(api, 'post').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { success } = form()
    await fill()
    fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: ' note ' } })
    const save = screen.getByRole('button', { name: 'Lưu phòng' })
    fireEvent.click(save)
    fireEvent.click(save)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post).toHaveBeenCalledWith('/rooms', {
      roomNumber: '201',
      floor: -1,
      roomType: active,
      status: 'AVAILABLE',
      notes: 'note',
      isActive: true,
    })
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled()
    finish({ data: room })
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
  })
  it.each([
    [409, 'Số phòng đã tồn tại', /^Số phòng/],
    [400, 'Loại phòng không hợp lệ hoặc đã ngừng', /^Loại phòng của phòng/],
    [400, 'floor must be an integer number', /^Tầng/],
    [400, 'status must be one of the following values', /^Trạng thái vận hành của phòng/],
  ])(
    'maps API %s field errors, preserves values and focuses the field',
    async (status, message, label) => {
      vi.spyOn(api, 'post').mockRejectedValue({
        isAxiosError: true,
        response: { status, data: { message } },
      })
      form()
      await fill()
      fireEvent.click(screen.getByRole('button', { name: 'Lưu phòng' }))
      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message)
      expect(screen.getByLabelText(/^Số phòng/)).toHaveValue(' 201 ')
      await waitFor(() => expect(screen.getByLabelText(label)).toHaveFocus())
    },
  )
  it('shows general errors and allows retry without discarding input', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('Mất kết nối'))
    form()
    await fill()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phòng' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra, vui lòng thử lại')
    expect(screen.getByLabelText(/^Số phòng/)).toHaveValue(' 201 ')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu phòng' })).toBeEnabled())
  })
  it('loads existing fields and sends only changed ones', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: room })
    form(room)
    expect(screen.getByLabelText(/^Số phòng/)).toHaveValue('101')
    expect(screen.getByLabelText(/^Tầng/)).toHaveValue(0)
    expect(screen.getByLabelText('Ghi chú')).toHaveValue('Ghi chú cũ')
    fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: ' Mới ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phòng' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith(`/rooms/${room.id}`, { notes: 'Mới' }))
  })
  it('deactivates only after confirmation, keeps reservation copy and sends only isActive', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: room })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    form(room)
    fireEvent.change(screen.getByLabelText(/^Số phòng/), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng nhận đặt phòng' }))
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('reservation đang hoạt động vẫn hợp lệ'),
    )
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('không nhận đặt phòng mới'))
    expect(patch).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng nhận đặt phòng' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/rooms/${room.id}`, { isActive: false }),
    )
    expect(screen.queryByRole('button', { name: /Xóa/ })).not.toBeInTheDocument()
  })
  it('reactivates with confirmation and an active type', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: room })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    form({ ...room, isActive: false })
    await screen.findByRole('option', { name: 'Standard' })
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt lại phòng' }))
    expect(patch).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt lại phòng' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith(`/rooms/${room.id}`, { isActive: true }))
  })
  it('keeps the inactive type visible, allows notes edits but blocks reactivation until replacement', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: room })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    form({ ...room, roomType: { id: inactive, name: 'Old', isActive: false }, isActive: false })
    expect(screen.getByRole('option', { name: 'Old (ngừng)' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phòng' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith(`/rooms/${room.id}`, { notes: 'Mới' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Kích hoạt lại phòng' })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt lại phòng' }))
    expect(screen.getByLabelText(/^Loại phòng của phòng/)).toHaveAttribute('aria-invalid', 'true')
    expect(patch).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText(/^Loại phòng của phòng/), { target: { value: active } })
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt lại phòng' }))
    await waitFor(() =>
      expect(patch).toHaveBeenLastCalledWith(`/rooms/${room.id}`, {
        notes: 'Mới',
        roomType: active,
        isActive: true,
      }),
    )
  })
  it('disables create when there are no active types and links to their management', async () => {
    vi.mocked(api.get).mockImplementation(async (url) =>
      url === '/room-types/options'
        ? { data: [] }
        : { data: { items: [], total: 0, page: 1, limit: 10 } },
    )
    renderWithAuth(roomRoutes, {
      path: '/manager/rooms',
      auth: { me: ME, status: 'authenticated' },
    })
    expect(await screen.findByText(/Chưa có loại phòng hoạt động/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm phòng' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Quản lý loại phòng' })).toHaveAttribute(
      'href',
      '/manager/room-types',
    )
  })
  it('keeps options loading and errors recoverable', async () => {
    let fail = true
    vi.mocked(api.get).mockImplementation(async () => {
      if (fail) throw new Error('Options offline')
      return { data: [{ id: active, name: 'Standard' }] }
    })
    form()
    expect(screen.getByText('Đang tải loại phòng khả dụng…')).toBeInTheDocument()
    await screen.findByRole('button', { name: 'Thử lại loại phòng khả dụng' })
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại loại phòng khả dụng' }))
    expect(await screen.findByRole('option', { name: 'Standard' })).toBeInTheDocument()
  })
  it('opens create/edit dialogs, loads details, handles Esc/restores focus and preserves filters/page on save', async () => {
    setupDialog()
    const get = vi.mocked(api.get)
    vi.spyOn(api, 'patch').mockResolvedValue({ data: room })
    renderWithAuth(roomRoutes, {
      path: '/manager/rooms',
      auth: { me: ME, status: 'authenticated' },
    })
    await screen.findByRole('rowheader', { name: '101' })
    fireEvent.change(screen.getByLabelText('Tìm theo số phòng'), { target: { value: '101' } })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/rooms', {
        params: expect.objectContaining({ search: '101' }),
      }),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/rooms', { params: expect.objectContaining({ page: 2 }) }),
    )
    const edit = await screen.findByRole('button', { name: 'Sửa phòng 101' })
    edit.focus()
    fireEvent.click(edit)
    expect(await screen.findByLabelText('Ghi chú')).toHaveValue('Ghi chú cũ')
    await waitFor(() => expect(screen.getByLabelText(/^Số phòng/)).toHaveFocus())
    fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'Mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phòng' }))
    expect(await screen.findByText('Đã lưu phòng. Danh sách đã được cập nhật.')).toBeInTheDocument()
    expect(screen.getByLabelText('Tìm theo số phòng')).toHaveValue('101')
    expect(screen.getByText(/Trang 2\/3/)).toBeInTheDocument()
    await waitFor(() => expect(edit).toHaveFocus())
    const add = screen.getByRole('button', { name: 'Thêm phòng' })
    add.focus()
    fireEvent.click(add)
    const dialog = screen.getByRole('dialog', { name: 'Thêm phòng' })
    expect(within(dialog).getByLabelText(/^Số phòng/)).toHaveValue('')
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(add).toHaveFocus()
  })
})
