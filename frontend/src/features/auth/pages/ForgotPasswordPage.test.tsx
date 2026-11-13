import { fireEvent, screen } from '@testing-library/react'
import { renderWithAuth } from '../test-utils'
import { ForgotPasswordPage } from './ForgotPasswordPage'

const routes = [
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/login', element: <p>trang đăng nhập</p> },
]

describe('ForgotPasswordPage', () => {
  it('gửi link đặt lại mật khẩu tới email đã nhập', async () => {
    const sendPasswordReset = vi.fn().mockResolvedValue(undefined)
    renderWithAuth(routes, { path: '/forgot-password', auth: { sendPasswordReset } })

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: ' a@b.vn ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi link đặt lại mật khẩu' }))

    expect(await screen.findByRole('status')).toHaveTextContent('a@b.vn')
    expect(sendPasswordReset).toHaveBeenCalledWith('a@b.vn')
    expect(screen.queryByRole('button', { name: 'Gửi link đặt lại mật khẩu' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Quay lại đăng nhập' }))
    expect(await screen.findByText('trang đăng nhập')).toBeInTheDocument()
  })

  it('hiển thị lỗi khi không gửi được', async () => {
    const sendPasswordReset = vi.fn().mockRejectedValue(new Error('Email không hợp lệ'))
    renderWithAuth(routes, { path: '/forgot-password', auth: { sendPasswordReset } })

    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.vn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi link đặt lại mật khẩu' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email không hợp lệ')
    expect(screen.getByRole('button', { name: 'Gửi link đặt lại mật khẩu' })).toBeEnabled()
  })

  it('chế độ dev (chưa có Firebase) thì không cho gửi', () => {
    renderWithAuth(routes, { path: '/forgot-password', auth: { isDevMode: true } })
    expect(screen.queryByRole('button', { name: 'Gửi link đặt lại mật khẩu' })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Firebase')
  })
})
