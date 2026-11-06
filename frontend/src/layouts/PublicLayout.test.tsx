import { fireEvent, screen, within } from '@testing-library/react'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { PublicLayout } from './PublicLayout'

const customer = { ...ME, role: 'CUSTOMER', fullName: 'Nguyễn Khách' }
const manager = { ...ME, role: 'MANAGER', fullName: 'Hoàng Quản Lý' }

const routes = [
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <h1>Trang chủ nội dung</h1> },
      { path: '/search', element: <h1>Tìm phòng</h1> },
      { path: '/my-feedback', element: <h1>Phản hồi</h1> },
    ],
  },
  { path: '/login', element: <h1>Trang đăng nhập</h1> },
]

function renderAt(path = '/', me: typeof ME | null = null) {
  return renderWithAuth(routes, {
    path,
    auth: me ? { me, status: 'authenticated' } : { me: null, status: 'anonymous' },
  })
}

const banner = () => within(screen.getByRole('banner'))
const mainNav = () => screen.getByRole('navigation', { name: 'Menu chính' })

describe('PublicLayout', () => {
  it('has the landmarks and a skip link', () => {
    renderAt()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bỏ qua điều hướng' })).toHaveAttribute('href', '#main')
  })

  it('offers the booking links and sign-in to visitors', () => {
    renderAt()
    const header = banner()
    expect(header.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/')
    expect(header.getByRole('link', { name: 'Phòng & suite' })).toHaveAttribute('href', '/search')
    expect(header.getByRole('link', { name: 'Trải nghiệm' })).toHaveAttribute(
      'href',
      '/experiences',
    )
    expect(header.getByRole('link', { name: 'Tra cứu đặt phòng' })).toHaveAttribute(
      'href',
      '/booking/lookup',
    )
    expect(header.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login')
    expect(header.getByRole('link', { name: 'Đặt phòng' })).toHaveAttribute('href', '/search')
  })

  it('marks the current page', () => {
    renderAt('/search')
    expect(banner().getByRole('link', { name: 'Phòng & suite' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(banner().getByRole('link', { name: 'Trang chủ' })).not.toHaveAttribute('aria-current')
  })

  it('gives a signed-in customer a single button to their dashboard', () => {
    renderAt('/', customer)
    const header = banner()
    expect(header.getByRole('link', { name: 'Vào dashboard' })).toHaveAttribute(
      'href',
      '/customer/dashboard',
    )
    expect(header.queryByRole('button', { name: 'Của tôi' })).not.toBeInTheDocument()
    expect(header.queryByRole('link', { name: 'Nguyễn Khách' })).not.toBeInTheDocument()
    expect(header.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument()
    expect(header.queryByRole('link', { name: 'Đăng nhập' })).not.toBeInTheDocument()
  })

  it('gives staff the same single button to their own workspace', () => {
    renderAt('/', manager)
    const header = banner()
    expect(header.getByRole('link', { name: 'Vào dashboard' })).toHaveAttribute(
      'href',
      '/manager/dashboard',
    )
    expect(header.queryByRole('link', { name: 'Hoàng Quản Lý' })).not.toBeInTheDocument()
    expect(header.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument()
  })

  it('sends a custom role to its first workspace page', () => {
    renderAt('/', { ...ME, role: 'CUSTOM_ROLE', permissions: ['task:execute'] })
    expect(banner().getByRole('link', { name: 'Vào dashboard' })).toHaveAttribute(
      'href',
      '/staff/tasks',
    )
  })

  it('collapses the menu behind a button on small screens', () => {
    renderAt('/search')
    const toggle = screen.getByRole('button', { name: 'Mở menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'main-nav')
    expect(mainNav()).toHaveAttribute('id', 'main-nav')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()

    fireEvent.click(toggle)
    fireEvent.click(banner().getByRole('link', { name: 'Trang chủ' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
