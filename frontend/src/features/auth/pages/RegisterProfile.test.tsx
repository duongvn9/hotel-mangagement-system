import { fireEvent, screen } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '../test-utils'
import { ProfilePage } from './ProfilePage'
import { RegisterPage } from './RegisterPage'

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

function fillRegister(confirm: string) {
  type(/Họ và tên/, ' Khách Mới ')
  type(/^Email/, 'new@mail.vn')
  type(/^Mật khẩu/, 'secret12')
  type(/Nhập lại mật khẩu/, confirm)
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }))
}

describe('RegisterPage', () => {
  it('mật khẩu nhập lại không khớp thì không gửi', () => {
    const register = vi.fn()
    renderWithAuth([{ path: '/', element: <RegisterPage /> }], { auth: { register } })
    fillRegister('khac123')
    expect(screen.getByText('Mật khẩu nhập lại không khớp')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('đăng ký xong thì nhắc xác minh email', async () => {
    const register = vi.fn().mockResolvedValue(undefined)
    renderWithAuth([{ path: '/', element: <RegisterPage /> }], { auth: { register } })
    fillRegister('secret12')
    expect(await screen.findByText(/Mở email new@mail.vn/)).toBeInTheDocument()
    expect(register).toHaveBeenCalledWith({
      email: 'new@mail.vn',
      password: 'secret12',
      fullName: 'Khách Mới',
      phone: undefined,
    })
  })
})

describe('ProfilePage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lưu họ tên, số điện thoại rồi tải lại thông tin', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} })
    const refresh = vi.fn().mockResolvedValue(undefined)
    renderWithAuth([{ path: '/', element: <ProfilePage /> }], {
      auth: { me: ME, status: 'authenticated', refresh },
    })

    expect(screen.getByText('Quản lý')).toBeInTheDocument()
    type(/Họ và tên/, 'Tên Mới')
    type(/Số điện thoại/, '0912345678')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByText('Đã lưu hồ sơ')).toBeInTheDocument()
    expect(patch).toHaveBeenCalledWith('/users/me', { fullName: 'Tên Mới', phone: '0912345678' })
    expect(refresh).toHaveBeenCalled()
  })
})
