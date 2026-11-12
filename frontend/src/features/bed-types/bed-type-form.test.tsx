import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { BedTypeForm } from './components/BedTypeForm'
import type { BedType } from './api'

const bedType: BedType = {
  id: 'abcdef0123456789abcdef04',
  name: 'Giường đôi',
  description: 'Old',
  isActive: true,
  roomTypes: [{ id: 'abcdef0123456789abcdef01', name: 'Standard', isActive: true }],
  roomTypeCount: 1,
}
function form(initial?: BedType) {
  const success = vi.fn()
  const close = vi.fn()
  renderWithAuth(
    [{ path: '/', element: <BedTypeForm initial={initial} onClose={close} onSuccess={success} /> }],
    { auth: { me: ME, status: 'authenticated' } },
  )
  return { success, close }
}
describe('bed type form', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  afterEach(() => vi.restoreAllMocks())
  it('validates and focuses the name before any request', async () => {
    const post = vi.spyOn(api, 'post')
    form()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại giường' }))
    expect(screen.getByLabelText(/^Tên loại giường/)).toHaveAccessibleDescription(
      'Nhập tên loại giường (tối đa 100 ký tự).',
    )
    await waitFor(() => expect(screen.getByLabelText(/^Tên loại giường/)).toHaveFocus())
    expect(post).not.toHaveBeenCalled()
  })
  it('creates trimmed fields once while pending and invalidates consumers', async () => {
    let finish!: (value: unknown) => void
    const post = vi.spyOn(api, 'post').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { success } = form()
    fireEvent.change(screen.getByLabelText(/^Tên loại giường/), {
      target: { value: '  Giường King  ' },
    })
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: '  note  ' } })
    const save = screen.getByRole('button', { name: 'Lưu loại giường' })
    fireEvent.click(save)
    fireEvent.click(save)
    await waitFor(() => expect(post).toHaveBeenCalledOnce())
    expect(post).toHaveBeenCalledWith('/bed-types', {
      name: 'Giường King',
      description: 'note',
      isActive: true,
    })
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled()
    finish({ data: bedType })
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    for (const queryKey of [['bed-types'], ['bed-type', undefined], ['bed-type-options']])
      expect(invalidate).toHaveBeenCalledWith({ queryKey })
  })
  it('preloads fields and sends only changed metadata', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: bedType })
    form(bedType)
    expect(screen.getByLabelText(/^Tên loại giường/)).toHaveValue('Giường đôi')
    expect(screen.getByLabelText('Mô tả')).toHaveValue('Old')
    fireEvent.change(screen.getByLabelText('Mô tả'), { target: { value: '  Changed  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại giường' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/bed-types/${bedType.id}`, { description: 'Changed' }),
    )
  })
  it('closes an unchanged edit without writing', async () => {
    const patch = vi.spyOn(api, 'patch')
    const { close } = form(bedType)
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại giường' }))
    expect(close).toHaveBeenCalledOnce()
    expect(patch).not.toHaveBeenCalled()
  })
  it('requires confirmation to deactivate', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: bedType })
    form(bedType)
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng loại giường' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('không thể gắn mới')
    expect(patch).not.toHaveBeenCalled()
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Ngừng loại giường' }),
    )
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/bed-types/${bedType.id}`, { isActive: false }),
    )
  })
  it('reactivates only after confirmation', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: bedType })
    form({ ...bedType, isActive: false })
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt lại loại giường' }))
    expect(patch).not.toHaveBeenCalled()
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Kích hoạt lại loại giường',
      }),
    )
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/bed-types/${bedType.id}`, { isActive: true }),
    )
  })
  it('maps 409 to the name field and keeps the draft', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Tên loại giường đã tồn tại' } },
    })
    form()
    fireEvent.change(screen.getByLabelText(/^Tên loại giường/), { target: { value: ' My name ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại giường' }))
    await screen.findByText('Tên loại giường đã tồn tại')
    expect(screen.getByLabelText(/^Tên loại giường/)).toHaveValue(' My name ')
    await waitFor(() => expect(screen.getByLabelText(/^Tên loại giường/)).toHaveFocus())
  })
})
