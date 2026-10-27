import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
    const nav = within(mainNav())
    expect(nav.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/')
    expect(nav.getByRole('link', { name: 'Đặt phòng' })).toHaveAttribute('href', '/search')
    expect(nav.getByRole('link', { name: 'Booking của tôi' })).toHaveAttribute(
      'href',
      '/my-bookings',
    )
    expect(nav.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login')
    expect(nav.getByRole('link', { name: 'Đăng ký' })).toHaveAttribute('href', '/register')
  })

  it('marks the current page', () => {
    renderAt('/search')
    expect(within(mainNav()).getByRole('link', { name: 'Đặt phòng' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(mainNav()).getByRole('link', { name: 'Trang chủ' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('keeps the customer pages in one menu', () => {
    renderAt('/', customer)
    const nav = within(mainNav())
    const toggle = nav.getByRole('button', { name: 'Của tôi' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(nav.queryByRole('link', { name: 'Dịch vụ của tôi' })).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(nav.getByRole('link', { name: 'Dịch vụ của tôi' })).toHaveAttribute(
      'href',
      '/customer/service-orders',
    )
    expect(nav.getByRole('link', { name: 'Phản hồi của tôi' })).toHaveAttribute(
      'href',
      '/my-feedback',
    )
    expect(nav.getByRole('link', { name: 'Nguyễn Khách' })).toHaveAttribute('href', '/profile')
  })

  it('closes the customer menu with Escape and returns focus to its button', () => {
    renderAt('/', customer)
    const toggle = within(mainNav()).getByRole('button', { name: 'Của tôi' })
    fireEvent.click(toggle)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
  })

  it('closes the customer menu after choosing a page', () => {
    renderAt('/', customer)
    const nav = within(mainNav())
    fireEvent.click(nav.getByRole('button', { name: 'Của tôi' }))
    fireEvent.click(nav.getByRole('link', { name: 'Phản hồi của tôi' }))
    expect(screen.getByRole('heading', { name: 'Phản hồi' })).toBeInTheDocument()
    expect(nav.getByRole('button', { name: 'Của tôi' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('sends staff to their workspace instead of listing every staff page', () => {
    renderAt('/', manager)
    const nav = within(mainNav())
    expect(nav.getByRole('link', { name: 'Khu làm việc' })).toHaveAttribute(
      'href',
      '/manager/dashboard',
    )
    expect(nav.queryByRole('link', { name: 'Tài khoản' })).not.toBeInTheDocument()
    expect(nav.queryByRole('button', { name: 'Của tôi' })).not.toBeInTheDocument()
  })

  it('lets a signed-in user sign out', async () => {
    const view = renderAt('/', customer)
    fireEvent.click(within(mainNav()).getByRole('button', { name: 'Đăng xuất' }))
    await waitFor(() => expect(view.auth.logout).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: 'Trang đăng nhập' })).toBeInTheDocument()
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
    fireEvent.click(within(mainNav()).getByRole('link', { name: 'Trang chủ' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
