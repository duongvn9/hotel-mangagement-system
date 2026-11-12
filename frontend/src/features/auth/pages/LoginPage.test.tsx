import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '../test-utils'
import { LoginPage } from './LoginPage'

const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <p>trang chủ</p> },
  { path: '/customer/dashboard', element: <p>tổng quan khách</p> },
  { path: '/manager/dashboard', element: <p>trang quản lý</p> },
  { path: '/reception/dashboard', element: <p>trang lễ tân</p> },
  { path: '/booking/new', element: <p>trang đặt phòng</p> },
  { path: '/reception/front-desk', element: <p>quầy lễ tân</p> },
  { path: '/manager/accounts', element: <p>quản lý tài khoản</p> },
  { path: '/my-bookings', element: <p>booking của tôi</p> },
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

  it('đăng nhập bằng Google rồi vào trang của vai trò', async () => {
    const loginWithGoogle = vi.fn().mockResolvedValue(undefined)
    renderWithAuth(routes, { path: '/login', auth: { loginWithGoogle } })

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục với Google' }))

    await screen.findByText('trang chủ')
    expect(loginWithGoogle).toHaveBeenCalledOnce()
  })

  it('đăng nhập Google thất bại thì hiện lỗi', async () => {
    const loginWithGoogle = vi.fn().mockRejectedValue(new Error('Tài khoản đã bị khoá'))
    renderWithAuth(routes, { path: '/login', auth: { loginWithGoogle } })

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục với Google' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tài khoản đã bị khoá')
  })

  it('chế độ dev không có nút Google', () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [] })
    renderWithAuth(routes, { path: '/login', auth: { isDevMode: true } })
    expect(screen.queryByRole('button', { name: 'Tiếp tục với Google' })).not.toBeInTheDocument()
  })

  describe('đã có phiên đăng nhập', () => {
    const signedIn = (role: string) =>
      renderWithAuth(routes, {
        path: '/login',
        auth: { me: { ...ME, role }, status: 'authenticated' },
      })

    it('đưa nhân viên vào trang làm việc của vai trò', async () => {
      signedIn('MANAGER')
      expect(await screen.findByText('trang quản lý')).toBeInTheDocument()
    })

    it('đưa lễ tân vào Tổng quan lễ tân', async () => {
      signedIn('RECEPTIONIST')
      expect(await screen.findByText('trang lễ tân')).toBeInTheDocument()
    })

    it('đưa khách vào tổng quan của khách', async () => {
      signedIn('CUSTOMER')
      expect(await screen.findByText('tổng quan khách')).toBeInTheDocument()
    })

    it.each([
      ['CUSTOMER', '/reception/dashboard', 'tổng quan khách'],
      ['CUSTOMER', '/manager/accounts', 'tổng quan khách'],
      ['RECEPTIONIST', '/manager/accounts', 'trang lễ tân'],
    ])(
      'đưa %s về trang chủ của vai trò khi trang đang xem dở (%s) không thuộc vai trò',
      async (role, from, expected) => {
        renderWithAuth(routes, {
          path: '/login',
          auth: { me: { ...ME, role }, status: 'authenticated' },
          state: { from },
        })
        expect(await screen.findByText(expected)).toBeInTheDocument()
      },
    )

    it.each([
      ['MANAGER', '/reception/front-desk', 'quầy lễ tân'],
      ['RECEPTIONIST', '/reception/front-desk', 'quầy lễ tân'],
      ['MANAGER', '/manager/accounts', 'quản lý tài khoản'],
      ['CUSTOMER', '/my-bookings', 'booking của tôi'],
    ])('giữ trang đang xem dở của %s khi vai trò được vào (%s)', async (role, from, expected) => {
      renderWithAuth(routes, {
        path: '/login',
        auth: { me: { ...ME, role }, status: 'authenticated' },
        state: { from },
      })
      expect(await screen.findByText(expected)).toBeInTheDocument()
    })

    it('quay lại trang đang xem dở trước khi bị yêu cầu đăng nhập', async () => {
      renderWithAuth(routes, {
        path: '/login',
        auth: { me: { ...ME, role: 'MANAGER' }, status: 'authenticated' },
        state: { from: '/booking/new' },
      })
      expect(await screen.findByText('trang đặt phòng')).toBeInTheDocument()
    })
  })
})
