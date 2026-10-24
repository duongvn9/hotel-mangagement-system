import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { ServiceForm } from './components/ServiceForm'
import { serviceRoutes } from './routes'
import type { Service } from './api'
const service: Service = {
  id: 'abcdef0123456789abcdef01',
  name: 'Laundry',
  description: 'Old',
  unit: 'lần',
  billable: true,
  price: 50000,
  isActive: true,
}
function form(initial?: Service) {
  const success = vi.fn()
  const close = vi.fn()
  renderWithAuth(
    [{ path: '/', element: <ServiceForm initial={initial} onClose={close} onSuccess={success} /> }],
    { auth: { me: ME, status: 'authenticated' } },
  )
  return { success, close }
}
function page() {
  return renderWithAuth(serviceRoutes, {
    path: '/manager/services',
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
const change = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Lưu dịch vụ' }))
describe('UC54 service form', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => configure({ asyncUtilTimeout: 1000 }))
  beforeEach(() => {
    vi.spyOn(api, 'get').mockImplementation(async (url) =>
      url === `/services/${service.id}`
        ? { data: service }
        : { data: { items: [service], total: 21, page: 1, limit: 10 } },
    )
  })
  afterEach(() => vi.restoreAllMocks())
  it('validates required name/price, describes errors and focuses the first invalid field', async () => {
    const post = vi.spyOn(api, 'post')
    form()
    save()
    expect(screen.getByLabelText(/^Tên dịch vụ/)).toHaveAccessibleDescription(
      'Nhập tên dịch vụ (tối đa 100 ký tự).',
    )
    expect(screen.getByLabelText(/^Giá VND/)).toHaveAccessibleDescription(
      'Cần giá hợp lệ để kích hoạt dịch vụ tính phí.',
    )
    await waitFor(() => expect(screen.getByLabelText(/^Tên dịch vụ/)).toHaveFocus())
    expect(post).not.toHaveBeenCalled()
    expect(screen.getByText(/Muốn lưu mà chưa có giá, đặt trạng thái Ngừng/)).toBeInTheDocument()
  })
  it.each(['-1', '1.5', '1,5', 'abc', '9007199254740992', '1.00.000'])(
    'rejects invalid VND input %s without sending',
    async (value) => {
      const post = vi.spyOn(api, 'post')
      form()
      change(/^Tên dịch vụ/, 'New')
      change(/^Giá VND/, value)
      save()
      expect(screen.getByLabelText(/^Giá VND/)).toHaveAttribute('aria-invalid', 'true')
      await waitFor(() => expect(screen.getByLabelText(/^Giá VND/)).toHaveFocus())
      expect(post).not.toHaveBeenCalled()
    },
  )
  it.each([
    { text: '0', amount: 0 },
    { text: '50.000', amount: 50000 },
  ])('submits trimmed text and valid price $text', async ({ text, amount }) => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: service })
    const { success } = form()
    change(/^Tên dịch vụ/, ' New ')
    change('Mô tả', ' note ')
    change('Đơn vị (tùy chọn)', ' lượt ')
    change(/^Giá VND/, text)
    save()
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    expect(post).toHaveBeenCalledWith('/services', {
      name: 'New',
      description: 'note',
      unit: 'lượt',
      billable: true,
      price: amount,
      isActive: true,
    })
  })
  it.each(['Tính phí', 'Đang hoạt động'])(
    'allows no price when %s is disabled and keeps price editable',
    async (label) => {
      const post = vi.spyOn(api, 'post').mockResolvedValue({ data: service })
      form()
      change(/^Tên dịch vụ/, 'Draft')
      fireEvent.click(screen.getByLabelText(label))
      expect(screen.getByLabelText(/^Giá VND/)).toBeEnabled()
      expect(screen.getByLabelText(/^Giá VND/)).not.toBeRequired()
      save()
      await waitFor(() =>
        expect(post).toHaveBeenCalledWith(
          '/services',
          expect.objectContaining({
            price: null,
            [label === 'Tính phí' ? 'billable' : 'isActive']: false,
          }),
        ),
      )
    },
  )
  it('formats price on blur and does not clear it when billable changes', () => {
    form()
    change(/^Giá VND/, '50000')
    fireEvent.blur(screen.getByLabelText(/^Giá VND/))
    expect(screen.getByLabelText(/^Giá VND/)).toHaveValue('50.000')
    fireEvent.click(screen.getByLabelText('Tính phí'))
    expect(screen.getByLabelText(/^Giá VND/)).toHaveValue('50.000')
  })
  it('locks repeated submits while pending and invalidates list/detail on success', async () => {
    let finish!: (value: unknown) => void
    const post = vi.spyOn(api, 'post').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const { success } = form()
    change(/^Tên dịch vụ/, 'Pending')
    change(/^Giá VND/, '0')
    const submit = screen.getByRole('button', { name: 'Lưu dịch vụ' })
    fireEvent.click(submit)
    fireEvent.click(submit)
    await waitFor(() => expect(post).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled()
    expect(screen.getByLabelText(/^Tên dịch vụ/)).toBeDisabled()
    finish({ data: service })
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['services'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['service'] })
  })
  it('preloads fields and sends only a changed description', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: service })
    form(service)
    expect(screen.getByLabelText(/^Tên dịch vụ/)).toHaveValue('Laundry')
    expect(screen.getByLabelText(/^Giá VND/)).toHaveValue('50.000')
    expect(screen.getByLabelText('Đơn vị (tùy chọn)')).toHaveValue('lần')
    change('Mô tả', ' New ')
    save()
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/services/${service.id}`, { description: 'New' }),
    )
  })
  it.each([
    { status: 409, message: 'Tên dịch vụ đã tồn tại', label: /^Tên dịch vụ/ },
    {
      status: 400,
      message: 'price: cần giá hợp lệ để kích hoạt dịch vụ tính phí',
      label: /^Giá VND/,
    },
  ])(
    'maps API $status errors to the right field and retains input',
    async ({ status, message, label }) => {
      vi.spyOn(api, 'post').mockRejectedValue({
        isAxiosError: true,
        response: { status, data: { message } },
      })
      form()
      change(/^Tên dịch vụ/, ' Draft ')
      change(/^Giá VND/, '0')
      save()
      await screen.findByText(message)
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message)
      expect(screen.getByLabelText(/^Tên dịch vụ/)).toHaveValue(' Draft ')
      await waitFor(() => expect(screen.getByLabelText(label)).toHaveFocus())
    },
  )
  it('retains draft after general errors and retries the same request', async () => {
    const patch = vi
      .spyOn(api, 'patch')
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue({ data: service })
    const { success } = form(service)
    change('Mô tả', 'Draft')
    save()
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Mô tả')).toHaveValue('Draft')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu dịch vụ' })).toBeEnabled())
    save()
    await waitFor(() => expect(success).toHaveBeenCalledOnce())
    expect(patch.mock.calls[0]).toEqual(patch.mock.calls[1])
  })
  it('keeps a conflicting draft until explicit reload confirmation, then loads the new data', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.spyOn(api, 'patch').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Dữ liệu đã thay đổi, hãy tải lại' } },
    })
    const get = vi.mocked(api.get)
    form(service)
    change('Mô tả', 'Unsaved draft')
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Dữ liệu đã thay đổi')
    expect(screen.getByLabelText('Mô tả')).toHaveValue('Unsaved draft')
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }))
    expect(get).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Mô tả')).toHaveValue('Unsaved draft')
    confirm.mockReturnValue(true)
    get.mockResolvedValueOnce({ data: { ...service, description: 'Winner data', price: 0 } })
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }))
    await waitFor(() => expect(screen.getByLabelText('Mô tả')).toHaveValue('Winner data'))
    expect(screen.getByLabelText(/^Giá VND/)).toHaveValue('0')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText(/^Tên dịch vụ/)).toHaveFocus())
  })
  it('retains the draft if reloading fails and offers another reload', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(api, 'patch').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Dữ liệu đã thay đổi, hãy tải lại' } },
    })
    form(service)
    change('Mô tả', 'Draft')
    save()
    await screen.findByRole('alert')
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại dữ liệu' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tải lại dữ liệu' })).toBeEnabled(),
    )
    expect(screen.getByLabelText('Mô tả')).toHaveValue('Draft')
    expect(screen.getByRole('alert')).toHaveTextContent('Có lỗi xảy ra')
  })
  it('deactivates only after confirmation using only isActive, preserving existing-request copy', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: service })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    form(service)
    change(/^Tên dịch vụ/, '')
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng dịch vụ' }))
    expect(patch).not.toHaveBeenCalled()
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('các yêu cầu dịch vụ đã có không bị ảnh hưởng'),
    )
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng dịch vụ' }))
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(`/services/${service.id}`, { isActive: false }),
    )
    expect(screen.queryByRole('button', { name: /Xóa/ })).not.toBeInTheDocument()
  })
  it('reactivates with confirmation and maps missing stored price from the server before saving price plus activation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const patch = vi
      .spyOn(api, 'patch')
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          data: { message: 'price: cần giá hợp lệ để kích hoạt dịch vụ tính phí' },
        },
      })
      .mockResolvedValue({ data: service })
    form({ ...service, isActive: false, price: null })
    fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt lại dịch vụ' }))
    await screen.findByText('price: cần giá hợp lệ để kích hoạt dịch vụ tính phí')
    expect(patch).toHaveBeenCalledWith(`/services/${service.id}`, { isActive: true })
    change(/^Giá VND/, '0')
    fireEvent.click(screen.getByLabelText('Đang hoạt động'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu dịch vụ' })).toBeEnabled())
    save()
    await waitFor(() =>
      expect(patch).toHaveBeenLastCalledWith(`/services/${service.id}`, {
        price: 0,
        isActive: true,
      }),
    )
  })
  it('opens details, preserves filters/page on save, restores focus and closes create on Esc', async () => {
    dialogs()
    const get = vi.mocked(api.get)
    vi.spyOn(api, 'patch').mockResolvedValue({ data: service })
    page()
    await screen.findByRole('rowheader', { name: 'Laundry' })
    change('Tìm theo tên', 'Laundry')
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/services', {
        params: expect.objectContaining({ search: 'Laundry' }),
      }),
    )
    change('Tính phí', 'true')
    change('Trạng thái', 'true')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trang sau' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/services', {
        params: { page: 2, limit: 10, search: 'Laundry', billable: true, isActive: true },
      }),
    )
    const edit = await screen.findByRole('button', { name: 'Sửa dịch vụ Laundry' })
    edit.focus()
    fireEvent.click(edit)
    await screen.findByLabelText('Mô tả')
    await waitFor(() => expect(screen.getByLabelText(/^Tên dịch vụ/)).toHaveFocus())
    change('Mô tả', 'Changed')
    const before = get.mock.calls.filter(([url]) => url === '/services').length
    save()
    await screen.findByText('Đã lưu dịch vụ.')
    expect(screen.getByLabelText('Tìm theo tên')).toHaveValue('Laundry')
    expect(screen.getByLabelText('Tính phí')).toHaveValue('true')
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('true')
    expect(screen.getByText(/Trang 2\/3/)).toBeInTheDocument()
    expect(get.mock.calls.filter(([url]) => url === '/services').length).toBeGreaterThan(before)
    await waitFor(() => expect(edit).toHaveFocus())
    const add = screen.getByRole('button', { name: 'Thêm dịch vụ' })
    add.focus()
    fireEvent.click(add)
    const dialog = screen.getByRole('dialog', { name: 'Thêm dịch vụ' })
    expect(within(dialog).getByLabelText(/^Tên dịch vụ/)).toHaveValue('')
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(add).toHaveFocus()
  })
  it('handles detail loading/error/retry and prevents Esc during a submit', async () => {
    dialogs()
    let fail = true
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === `/services/${service.id}`) {
        if (fail) throw new Error('Offline')
        return { data: service }
      }
      return { data: { items: [service], total: 1, page: 1, limit: 10 } }
    })
    page()
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa dịch vụ Laundry' }))
    expect(screen.getByText('Đang tải chi tiết…')).toBeInTheDocument()
    await screen.findByRole('alert')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByLabelText('Mô tả')
    vi.spyOn(api, 'patch').mockImplementation(() => new Promise(() => {}))
    change('Mô tả', 'Pending')
    save()
    await screen.findByRole('button', { name: 'Đang xử lý…' })
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
