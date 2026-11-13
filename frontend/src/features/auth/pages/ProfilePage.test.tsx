import { fireEvent, screen } from '@testing-library/react'
import { ME, renderWithAuth } from '../test-utils'
import { ProfilePage } from './ProfilePage'

const routes = [{ path: '/profile', element: <ProfilePage /> }]

function openPasswordTab() {
  // Radix Tabs đổi tab khi mousedown, không phải click.
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Mật khẩu' }))
}

function fill(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('ProfilePage password tab', () => {
  it('tài khoản chưa có mật khẩu (Google) đặt mật khẩu mới', async () => {
    const setPassword = vi.fn().mockResolvedValue(undefined)
    renderWithAuth(routes, { path: '/profile', auth: { me: ME, hasPassword: false, setPassword } })
    openPasswordTab()

    expect(screen.getByRole('heading', { name: 'Đặt mật khẩu' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Mật khẩu hiện tại/)).toBeNull()
    fill(/^Mật khẩu mới/, 'secret12')
    fill(/Xác nhận mật khẩu mới/, 'secret12')
    fireEvent.click(screen.getByRole('button', { name: 'Đặt mật khẩu' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Đã đặt mật khẩu')
    expect(setPassword).toHaveBeenCalledWith('secret12', undefined)
  })

  it('mật khẩu nhập lại không khớp thì không gửi', () => {
    const setPassword = vi.fn()
    renderWithAuth(routes, { path: '/profile', auth: { me: ME, hasPassword: false, setPassword } })
    openPasswordTab()

    fill(/^Mật khẩu mới/, 'secret12')
    fill(/Xác nhận mật khẩu mới/, 'secret13')
    fireEvent.click(screen.getByRole('button', { name: 'Đặt mật khẩu' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Mật khẩu nhập lại không khớp')
    expect(setPassword).not.toHaveBeenCalled()
  })

  it('tài khoản đã có mật khẩu thì đổi mật khẩu bằng mật khẩu hiện tại', async () => {
    const setPassword = vi.fn().mockResolvedValue(undefined)
    renderWithAuth(routes, { path: '/profile', auth: { me: ME, hasPassword: true, setPassword } })
    openPasswordTab()

    expect(screen.getByRole('heading', { name: 'Đổi mật khẩu' })).toBeInTheDocument()
    fill(/Mật khẩu hiện tại/, 'old-pass')
    fill(/^Mật khẩu mới/, 'secret12')
    fill(/Xác nhận mật khẩu mới/, 'secret12')
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Đã cập nhật mật khẩu')
    expect(setPassword).toHaveBeenCalledWith('secret12', 'old-pass')
    expect(screen.getByLabelText(/Mật khẩu hiện tại/)).toHaveValue('')
  })

  it('báo lỗi khi Firebase từ chối', async () => {
    const setPassword = vi.fn().mockRejectedValue(new Error('Mật khẩu hiện tại không đúng'))
    renderWithAuth(routes, { path: '/profile', auth: { me: ME, hasPassword: true, setPassword } })
    openPasswordTab()

    fill(/Mật khẩu hiện tại/, 'wrong')
    fill(/^Mật khẩu mới/, 'secret12')
    fill(/Xác nhận mật khẩu mới/, 'secret12')
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Mật khẩu hiện tại không đúng')
  })

  it('chế độ dev không có tab mật khẩu', () => {
    renderWithAuth(routes, { path: '/profile', auth: { me: ME, isDevMode: true } })
    expect(screen.queryByRole('tab', { name: 'Mật khẩu' })).toBeNull()
    expect(screen.getByLabelText(/Họ và tên/)).toBeInTheDocument()
  })
})
