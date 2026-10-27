import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { StaffLayout } from './StaffLayout'

const manager = { ...ME, role: 'MANAGER', fullName: 'Hoàng Thị Quản Lý' }
const receptionist = { ...ME, role: 'RECEPTIONIST', fullName: 'Trần Lễ Tân' }

const routes = [
  {
    element: <StaffLayout />,
    children: [
      { path: '/manager/dashboard', element: <h1>Trang tổng quan</h1> },
      { path: '/manager/rooms', element: <h1>Trang phòng</h1> },
      { path: '/reception/bookings/:code/edit', element: <h1>Sửa booking</h1> },
      { path: '/reception/front-desk', element: <h1>Đến và đi</h1> },
    ],
  },
  { path: '/login', element: <h1>Trang đăng nhập</h1> },
  { path: '/', element: <h1>Trang chủ</h1> },
]

function renderAt(path: string, me: typeof ME | null = manager) {
  return renderWithAuth(routes, {
    path,
    auth: me ? { me, status: 'authenticated' } : { me: null, status: 'anonymous' },
  })
}

const sidebar = () => screen.getByRole('navigation', { name: 'Menu nhân viên' })

describe('StaffLayout', () => {
  it('sends visitors who are not signed in to the login page', async () => {
    renderAt('/manager/dashboard', null)
    expect(await screen.findByRole('heading', { name: 'Trang đăng nhập' })).toBeInTheDocument()
  })

  it('waits for the session instead of flashing the page', () => {
    renderWithAuth(routes, {
      path: '/manager/dashboard',
      auth: { me: null, status: 'loading' },
    })
    expect(screen.queryByRole('heading', { name: 'Trang tổng quan' })).not.toBeInTheDocument()
    expect(screen.getByText('Đang tải…')).toBeInTheDocument()
  })

  it('shows the manager menu in groups next to the page', () => {
    renderAt('/manager/dashboard')
    expect(screen.getByRole('heading', { name: 'Trang tổng quan' })).toBeInTheDocument()
    const menu = within(sidebar())
    for (const group of ['Giám sát', 'Báo cáo', 'Cơ sở vật chất', 'Quản trị', 'Lễ tân']) {
      expect(menu.getByText(group)).toBeInTheDocument()
    }
    expect(menu.getByRole('link', { name: 'Phòng' })).toHaveAttribute('href', '/manager/rooms')
    expect(menu.getByRole('link', { name: 'Sơ đồ phòng' })).toHaveAttribute(
      'href',
      '/reception/rooms',
    )
  })

  it('shows the reception menu without manager pages', () => {
    renderAt('/reception/front-desk', receptionist)
    const menu = within(sidebar())
    expect(menu.getByRole('link', { name: 'Đến và đi trong ngày' })).toBeInTheDocument()
    expect(menu.queryByRole('link', { name: 'Tài khoản' })).not.toBeInTheDocument()
  })

  it('marks the current page, including its sub-pages', () => {
    const first = renderAt('/manager/rooms')
    expect(within(sidebar()).getByRole('link', { name: 'Phòng' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(sidebar()).getByRole('link', { name: 'Tổng quan' })).not.toHaveAttribute(
      'aria-current',
    )
    first.unmount()

    renderAt('/reception/bookings/BK1/edit', receptionist)
    expect(within(sidebar()).getByRole('link', { name: 'Danh sách booking' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('shows who is signed in and lets them sign out', async () => {
    const view = renderAt('/manager/dashboard')
    expect(screen.getByRole('link', { name: 'Hoàng Thị Quản Lý' })).toHaveAttribute(
      'href',
      '/profile',
    )
    expect(screen.getByText('Quản lý')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    await waitFor(() => expect(view.auth.logout).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: 'Trang đăng nhập' })).toBeInTheDocument()
  })

  it('offers a way back to the guest site and a skip link', () => {
    renderAt('/manager/dashboard')
    expect(within(sidebar()).getByRole('link', { name: 'Xem trang khách' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: 'Bỏ qua điều hướng' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('opens and closes the menu drawer on small screens', () => {
    renderAt('/manager/dashboard')
    const toggle = screen.getByRole('button', { name: 'Mở menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'staff-sidebar')
    expect(screen.queryByRole('button', { name: 'Đóng menu' })).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Mở menu' })).toHaveAttribute('aria-expanded', 'true')
    const overlay = screen.getByRole('button', { name: 'Đóng menu' })

    fireEvent.click(overlay)
    expect(screen.queryByRole('button', { name: 'Đóng menu' })).not.toBeInTheDocument()
  })

  it('closes the drawer with Escape and returns focus to the menu button', () => {
    renderAt('/manager/dashboard')
    const toggle = screen.getByRole('button', { name: 'Mở menu' })
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Đóng menu' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Đóng menu' })).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })

  it('closes the drawer after choosing a page', () => {
    renderAt('/manager/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    fireEvent.click(within(sidebar()).getByRole('link', { name: 'Phòng' }))
    expect(screen.getByRole('heading', { name: 'Trang phòng' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đóng menu' })).not.toBeInTheDocument()
  })

  it('does not give customers the staff menu', () => {
    renderAt('/manager/dashboard', { ...ME, role: 'CUSTOMER', fullName: 'Khách' })
    expect(screen.queryByRole('navigation', { name: 'Menu nhân viên' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trang tổng quan' })).toBeInTheDocument()
  })

  it('says so when a custom role has no menu entries yet', () => {
    renderAt('/manager/dashboard', { ...ME, role: 'CUSTOM_ROLE', fullName: 'Vai trò mới' })
    expect(within(sidebar()).getByText(/Chưa có mục menu/)).toBeInTheDocument()
  })
})
