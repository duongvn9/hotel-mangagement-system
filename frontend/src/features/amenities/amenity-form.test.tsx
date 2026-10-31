import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { AmenityForm } from './components/AmenityForm'
import { amenityRoutes } from './routes'
import type { Amenity } from './api'

const active = 'abcdef0123456789abcdef01'
const other = 'abcdef0123456789abcdef02'
const inactive = 'abcdef0123456789abcdef03'
const amenity: Amenity = {
  id: 'abcdef0123456789abcdef04',
  name: 'Wi-Fi',
  description: 'Old',
  isActive: true,
  roomTypes: [
    { id: active, name: 'Standard', isActive: true },
    { id: inactive, name: 'Suite', isActive: false },
  ],
  roomTypeCount: 2,
}
function form(initial?: Amenity) {
  const success = vi.fn()
  const close = vi.fn()
  renderWithAuth(
    [{ path: '/', element: <AmenityForm initial={initial} onClose={close} onSuccess={success} /> }],
    { auth: { me: ME, status: 'authenticated' } },
  )
  return { success, close }
}
function page() {
  return renderWithAuth(amenityRoutes, {
    path: '/manager/amenities',
    auth: { me: ME, status: 'authenticated' },
  })
}
function dialogs() {
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
describe('UC52 amenity form', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  beforeEach(() => {
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/room-types/options')
        return {
          data: [
            { id: active, name: 'Standard' },
            { id: other, name: 'Deluxe' },
          ],
        }
      if (url === `/amenities/${amenity.id}`) return { data: amenity }
      return { data: { items: [amenity], total: 21, page: 1, limit: 10 } }
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  it('uploads selected photos before saving the amenity gallery', async () => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL() {
          return 'blob:amenity-preview'
        }
        static revokeObjectURL() {}
      },
    )
    const post = vi.spyOn(api, 'post').mockImplementation(async (url) => ({
      data: url === '/amenities/images' ? { path: '/images/seeds/amenities/new.jpg' } : amenity,
    }))
    const { success } = form()
    fireEvent.change(screen.getByLabelText(/^Tên tiện nghi/), { target: { value: 'New amenity' } })
    fireEvent.change(screen.getByLabelText('Ảnh tiện nghi'), {
      target: { files: [new File(['image'], 'amenity.jpg', { type: 'image/jpeg' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    await waitFor(() => expect(success).toHaveBeenCalled())
    expect(post).toHaveBeenNthCalledWith(1, '/amenities/images', expect.any(FormData), {
      timeout: 120_000,
    })
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/amenities',
      expect.objectContaining({ images: ['/images/seeds/amenities/new.jpg'] }),
    )
  })
  it('rejects unsupported uploads without calling the server', () => {
    const post = vi.spyOn(api, 'post')
    form()
    fireEvent.change(screen.getByLabelText('Ảnh tiện nghi'), {
      target: { files: [new File(['svg'], 'icon.svg', { type: 'image/svg+xml' })] },
    })
    expect(
      screen.getByText('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh.'),
    ).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })
  it('removes a legacy icon by saving an empty gallery', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: amenity })
    const { success } = form({ ...amenity, iconUrl: '/images/seeds/amenities/wifi.svg' })
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ảnh 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    await waitFor(() => expect(success).toHaveBeenCalled())
    expect(patch).toHaveBeenCalledWith(`/amenities/${amenity.id}`, { images: [] })
  })
  it('validates and focuses name, and searches Room Types without Room selection', async () => {
    const post = vi.spyOn(api, 'post')
    form()
    await screen.findByLabelText('Standard')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    expect(screen.getByLabelText(/^Tên tiện nghi/)).toHaveAccessibleDescription(
      'Nhập tên tiện nghi (tối đa 100 ký tự).',
    )
    await waitFor(() => expect(screen.getByLabelText(/^Tên tiện nghi/)).toHaveFocus())
    expect(post).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Tìm loại phòng'), { target: { value: ' delu ' } })
    expect(screen.getByLabelText('Deluxe')).toBeInTheDocument()
    expect(screen.queryByLabelText('Standard')).not.toBeInTheDocument()
    expect(vi.mocked(api.get).mock.calls.map((call) => call[0])).toEqual(['/room-types/options'])
  })
  it('creates trimmed fields once while pending, preserves target selection and invalidates all consumers', async () => {
    let finish!: (value: unknown) => void
    const post = vi.spyOn(api, 'post').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { success } = form()
    await screen.findByLabelText('Standard')
    fireEvent.change(screen.getByLabelText(/^Tên tiện nghi/), {
      target: { value: '  New Wi-Fi  ' },
    })
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: '  note  ' } })
    fireEvent.click(screen.getByLabelText('Standard'))
    const save = screen.getByRole('button', { name: 'Lưu tiện nghi' })
    fireEvent.click(save)
    fireEvent.click(save)
    await waitFor(() => expect(post).toHaveBeenCalledOnce())
    expect(post).toHaveBeenCalledWith('/amenities', {
      name: 'New Wi-Fi',
      description: 'note',
      isActive: true,
      roomTypeIds: [active],
    })
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled()
    expect(screen.getByLabelText(/^Tên tiện nghi/)).toBeDisabled()
    finish({ data: amenity })
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    for (const queryKey of [
      ['amenities'],
      ['amenity', undefined],
      ['amenity-options'],
      ['room-types'],
      ['room-type'],
    ])
      expect(invalidate).toHaveBeenCalledWith({ queryKey })
  })
  it('allows creation without any Room Type and preserves an inactive empty amenity', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: amenity })
    form()
    await screen.findByText('Chưa có Room Type nào')
    fireEvent.change(screen.getByLabelText(/^Tên tiện nghi/), { target: { value: 'Unused' } })
    fireEvent.click(screen.getByLabelText('Đang hoạt động'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/amenities', {
        name: 'Unused',
        description: '',
        isActive: false,
        roomTypeIds: [],
      }),
    )
  })
  it('preloads fields and sends only changed metadata without relationship replacement', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: amenity })
    form(amenity)
    expect(screen.getByLabelText(/^Tên tiện nghi/)).toHaveValue('Wi-Fi')
    expect(screen.getByLabelText('Mô tả')).toHaveValue('Old')
    expect(screen.getByLabelText('Suite (ngừng)')).toBeChecked()
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: '  Changed  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/amenities/${amenity.id}`, { description: 'Changed' }),
    )
  })
  it('removes inactive links and sends the complete target set', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: amenity })
    form(amenity)
    await screen.findByLabelText('Deluxe')
    fireEvent.click(screen.getByLabelText('Suite (ngừng)'))
    fireEvent.click(screen.getByLabelText('Deluxe'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/amenities/${amenity.id}`, {
        roomTypeIds: [active, other],
      }),
    )
  })
  it('blocks new selections while inactive, permits removals and enables new choices on reactivation', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: amenity })
    form({ ...amenity, isActive: false })
    await screen.findByLabelText('Deluxe')
    expect(screen.getByLabelText('Deluxe')).toBeDisabled()
    expect(screen.getByText(/bật lại để gắn thêm/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Suite (ngừng)'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/amenities/${amenity.id}`, { roomTypeIds: [active] }),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu tiện nghi' })).toBeEnabled())
    fireEvent.click(screen.getByLabelText('Đang hoạt động'))
    expect(screen.getByLabelText('Deluxe')).toBeEnabled()
  })
  it('requires confirmation for separate deactivate/reactivate actions and preserves links', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: amenity })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    form(amenity)
    fireEvent.change(screen.getByLabelText(/^Tên tiện nghi/), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng tiện nghi' }))
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('giữ lại cùng các gắn kết hiện có, nhưng không thể gắn mới'),
    )
    expect(patch).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng tiện nghi' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/amenities/${amenity.id}`, { isActive: false }),
    )
    expect(screen.queryByRole('button', { name: /Xóa/ })).not.toBeInTheDocument()
  })
  it('reactivates only after confirmation', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: amenity })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    form({ ...amenity, isActive: false })
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt lại tiện nghi' }))
    expect(patch).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt lại tiện nghi' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/amenities/${amenity.id}`, { isActive: true }),
    )
  })
  it('maps 409 to name, retains draft and focuses the field', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Tên tiện nghi đã tồn tại' } },
    })
    form()
    fireEvent.change(screen.getByLabelText(/^Tên tiện nghi/), { target: { value: ' My name ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    await screen.findByText('Tên tiện nghi đã tồn tại')
    expect(screen.getByLabelText(/^Tên tiện nghi/)).toHaveValue(' My name ')
    expect(screen.getByLabelText(/^Tên tiện nghi/)).toHaveAccessibleDescription(
      'Tên tiện nghi đã tồn tại',
    )
    await waitFor(() => expect(screen.getByLabelText(/^Tên tiện nghi/)).toHaveFocus())
  })
  it('maps rejected RoomType IDs to names on the accessible selection group', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { message: `Room Type không hợp lệ hoặc đã ngừng: ${other}` },
      },
    })
    form()
    await screen.findByLabelText('Deluxe')
    fireEvent.change(screen.getByLabelText(/^Tên tiện nghi/), { target: { value: 'New' } })
    fireEvent.click(screen.getByLabelText('Deluxe'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    const group = screen.getByRole('group', { name: 'Gắn vào Room Type' })
    await waitFor(() =>
      expect(group).toHaveAccessibleDescription('Room Type không hợp lệ hoặc đã ngừng: Deluxe'),
    )
    await waitFor(() => expect(group).toHaveFocus())
    expect(screen.getByLabelText('Deluxe')).toBeChecked()
  })
  it('retains draft on partial write error and retries exactly the same target', async () => {
    const patch = vi
      .spyOn(api, 'patch')
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 503, data: { message: 'Lưu chưa hoàn tất; gửi lại cùng yêu cầu' } },
      })
      .mockResolvedValue({ data: amenity })
    const { success } = form(amenity)
    await screen.findByLabelText('Deluxe')
    fireEvent.click(screen.getByLabelText('Deluxe'))
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('gửi lại')
    expect(screen.getByLabelText('Mô tả')).toHaveValue('Draft')
    expect(screen.getByLabelText('Deluxe')).toBeChecked()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu tiện nghi' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    expect(patch.mock.calls[0]).toEqual(patch.mock.calls[1])
  })
  it('shows options loading, errors and retry without losing typed input', async () => {
    let fail = true
    vi.mocked(api.get).mockImplementation(async () => {
      if (fail) throw new Error('Offline')
      return { data: [{ id: active, name: 'Standard' }] }
    })
    form()
    expect(screen.getByText('Đang tải loại phòng…')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Tên tiện nghi/), { target: { value: 'Draft' } })
    await screen.findByRole('button', { name: 'Thử lại loại phòng' })
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại loại phòng' }))
    await screen.findByLabelText('Standard')
    expect(screen.getByLabelText(/^Tên tiện nghi/)).toHaveValue('Draft')
  })
  it('opens details, saves with filters/page intact and restores focus; create closes on Esc', async () => {
    dialogs()
    const get = vi.mocked(api.get)
    vi.spyOn(api, 'patch').mockResolvedValue({ data: amenity })
    page()
    await screen.findByRole('rowheader', { name: 'Wi-Fi' })
    fireEvent.change(screen.getByLabelText('Tìm theo tên'), { target: { value: 'Wi' } })
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/amenities', {
        params: expect.objectContaining({ search: 'Wi' }),
      }),
    )
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'true' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/amenities', {
        params: { search: 'Wi', isActive: true, page: 2, limit: 10 },
      }),
    )
    const edit = await screen.findByRole('button', { name: 'Sửa tiện nghi Wi-Fi' })
    edit.focus()
    fireEvent.click(edit)
    await screen.findByLabelText('Mô tả')
    await waitFor(() => expect(screen.getByLabelText(/^Tên tiện nghi/)).toHaveFocus())
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Changed' } })
    const listCallsBeforeSave = get.mock.calls.filter(([url]) => url === '/amenities').length
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    await screen.findByText('Đã lưu tiện nghi.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Tìm theo tên')).toHaveValue('Wi')
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('true')
    expect(screen.getByText(/Trang 2\/3/)).toBeInTheDocument()
    await waitFor(() => expect(edit).toHaveFocus())
    const listCallsAfterSave = get.mock.calls.filter(([url]) => url === '/amenities')
    expect(listCallsAfterSave.length).toBeGreaterThan(listCallsBeforeSave)
    expect(listCallsAfterSave.at(-1)).toEqual([
      '/amenities',
      {
        params: { search: 'Wi', isActive: true, page: 2, limit: 10 },
      },
    ])
    const add = screen.getByRole('button', { name: 'Thêm tiện nghi' })
    add.focus()
    fireEvent.click(add)
    const dialog = screen.getByRole('dialog', { name: 'Thêm tiện nghi' })
    expect(within(dialog).getByLabelText(/^Tên tiện nghi/)).toHaveValue('')
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(add).toHaveFocus()
  })
  it('detail loading and errors are recoverable; Esc is blocked during submit', async () => {
    dialogs()
    const get = vi.mocked(api.get)
    let fail = true
    get.mockImplementation(async (url) => {
      if (url === `/amenities/${amenity.id}`) {
        if (fail) throw new Error('Offline')
        return { data: amenity }
      }
      if (url === '/room-types/options') return { data: [] }
      return { data: { items: [amenity], total: 1, page: 1, limit: 10 } }
    })
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa tiện nghi Wi-Fi' }))
    expect(screen.getByText('Đang tải chi tiết…')).toBeInTheDocument()
    await screen.findByRole('alert')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByLabelText('Mô tả')
    vi.spyOn(api, 'patch').mockImplementation(() => new Promise(() => {}))
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: 'Pending' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tiện nghi' }))
    await screen.findByRole('button', { name: 'Đang xử lý…' })
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
