import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { renderWithAuth } from '../test-utils'
import { LoginPage } from './LoginPage'

const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <p>trang chủ</p> },
]

describe('LoginPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('đăng nhập bằng email, mật khẩu rồi về trang chủ', async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    renderWithAuth(routes, { path: '/login', auth: { login } })

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: ' a@b.vn ' } })
    fireEvent.change(screen.getByLabelText(/Mật khẩu/), { target: { value: 'secret12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    await screen.findByText('trang chủ')
    expect(login).toHaveBeenCalledWith('a@b.vn', 'secret12')
  })

  it('hiển thị lỗi khi đăng nhập thất bại', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Email chưa được xác minh'))
    renderWithAuth(routes, { path: '/login', auth: { login } })

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.vn' } })
    fireEvent.change(screen.getByLabelText(/Mật khẩu/), { target: { value: 'secret12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email chưa được xác minh')
  })

  it('chế độ dev: chọn tài khoản mẫu để đăng nhập', async () => {
    const account = { id: 'u1', email: 'manager@hms.local', fullName: 'Quản Lý', role: 'MANAGER' }
    vi.spyOn(api, 'get').mockResolvedValue({ data: [account] })
    const loginAsDev = vi.fn().mockResolvedValue(undefined)
    renderWithAuth(routes, { path: '/login', auth: { isDevMode: true, loginAsDev } })

    fireEvent.click(await screen.findByRole('button', { name: /Quản Lý/ }))
    await waitFor(() => expect(loginAsDev).toHaveBeenCalledWith(account))
  })
})
