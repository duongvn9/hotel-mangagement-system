import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ROLE_LABELS } from '@/features/auth/api'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { shellGroupsFor } from '@/app/workspace-nav'
import { WorkspaceShell } from './WorkspaceShell'

const manager = { ...ME, role: 'MANAGER', fullName: 'Hoàng Thị Quản Lý' }
const receptionist = { ...ME, role: 'RECEPTIONIST', fullName: 'Trần Lễ Tân' }

const routes = [
  {
    element: <WorkspaceShell />,
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

describe('WorkspaceShell', () => {
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
    fireEvent.keyDown(screen.getByRole('button', { name: 'Hoàng Thị Quản Lý' }), { key: 'Enter' })
    const profileItem = await screen.findByRole('menuitem', { name: 'Hồ sơ & cài đặt' })
    expect(profileItem).toHaveAttribute('href', '/profile')
    expect(screen.getByText('Quản lý')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }))
    await waitFor(() => expect(view.auth.logout).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: 'Trang đăng nhập' })).toBeInTheDocument()
  })

  it('shows an error and stays on the current page when sign-out fails', async () => {
    const logout = vi.fn().mockRejectedValue(new Error('Network error'))
    renderWithAuth(routes, {
      path: '/manager/dashboard',
      auth: { me: manager, status: 'authenticated', logout },
    })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Hoàng Thị Quản Lý' }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Đăng xuất' }))
    await waitFor(() => expect(logout).toHaveBeenCalled())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Đăng xuất không thành công, vui lòng thử lại')
    expect(screen.getByRole('heading', { name: 'Trang tổng quan' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Trang đăng nhập' })).not.toBeInTheDocument()
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

  it('gives customers their own menu instead of the staff menu', () => {
    renderAt('/manager/dashboard', { ...ME, role: 'CUSTOMER', fullName: 'Khách' })
    expect(screen.queryByRole('navigation', { name: 'Menu nhân viên' })).not.toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Menu khách hàng' })
    expect(within(nav).getByRole('link', { name: 'Booking của tôi' })).toHaveAttribute(
      'href',
      '/my-bookings',
    )
    expect(within(nav).getByRole('link', { name: 'Dịch vụ của tôi' })).toHaveAttribute(
      'href',
      '/customer/service-orders',
    )
    expect(screen.getByRole('heading', { name: 'Trang tổng quan' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  })

  it('says so when a custom role has no menu entries yet', () => {
    renderAt('/manager/dashboard', { ...ME, role: 'CUSTOM_ROLE', fullName: 'Vai trò mới' })
    expect(within(sidebar()).getByText(/Chưa có mục menu/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Role matrix — bảo vệ cho mọi role
// ---------------------------------------------------------------------------

type RoleFixture = {
  role: string
  startPath: string
  navLabel: string
  publicSiteLabel: string
}

const ROLE_FIXTURES: RoleFixture[] = [
  {
    role: 'MANAGER',
    startPath: '/manager/dashboard',
    navLabel: 'Menu nhân viên',
    publicSiteLabel: 'Xem trang khách',
  },
  {
    role: 'RECEPTIONIST',
    startPath: '/reception/dashboard',
    navLabel: 'Menu nhân viên',
    publicSiteLabel: 'Xem trang khách',
  },
  {
    role: 'SERVICE_STAFF',
    startPath: '/staff/service/dashboard',
    navLabel: 'Menu nhân viên',
    publicSiteLabel: 'Xem trang khách',
  },
  {
    role: 'OPERATIONS_STAFF',
    startPath: '/staff/operations/dashboard',
    navLabel: 'Menu nhân viên',
    publicSiteLabel: 'Xem trang khách',
  },
  {
    role: 'CUSTOMER',
    startPath: '/my-bookings',
    navLabel: 'Menu khách hàng',
    publicSiteLabel: 'Về trang chủ',
  },
]

describe.each(ROLE_FIXTURES)('role $role in WorkspaceShell', (fixture) => {
  const me = { ...ME, role: fixture.role, fullName: `Người dùng ${fixture.role}` }
  const matrixRoutes = [
    {
      element: <WorkspaceShell />,
      children: [{ path: '*', element: <h1>Trang bên trong</h1> }],
    },
    { path: '/login', element: <h1>Trang đăng nhập</h1> },
    { path: '/', element: <h1>Trang chủ</h1> },
  ]

  function render() {
    return renderWithAuth(matrixRoutes, {
      path: fixture.startPath,
      auth: { me, status: 'authenticated' },
    })
  }

  it('(a) has correct number of nav links and each has an svg icon', () => {
    render()
    const nav = screen.getByRole('navigation', { name: fixture.navLabel })
    const expectedItems = shellGroupsFor(me).flatMap((g) => g.items)
    const links = within(nav).getAllByRole('link')
    // subtract the public site link at the bottom (last link in nav)
    const menuLinks = links.filter((l) => l.getAttribute('href') !== '/')
    expect(menuLinks).toHaveLength(expectedItems.length)
    for (const link of menuLinks) {
      expect(link.querySelector('svg')).toBeTruthy()
    }
    for (const item of expectedItems) {
      expect(within(nav).getByRole('link', { name: item.label })).toHaveAttribute('href', item.to)
    }
  })

  it('(b) exactly one link is aria-current=page', () => {
    render()
    const nav = screen.getByRole('navigation', { name: fixture.navLabel })
    const currentLinks = within(nav)
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page')
    expect(currentLinks).toHaveLength(1)
  })

  it('(c) exactly one navigation even after opening drawer', () => {
    render()
    const navsBefore = screen.getAllByRole('navigation', { name: fixture.navLabel })
    expect(navsBefore).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    const navsAfter = screen.getAllByRole('navigation', { name: fixture.navLabel })
    expect(navsAfter).toHaveLength(1)
  })

  it('(d) header shows Khu làm việc + role label', () => {
    render()
    const expectedLabel = ROLE_LABELS[fixture.role] ?? fixture.role
    expect(screen.getByText(new RegExp(`Khu làm việc ${expectedLabel}`))).toBeInTheDocument()
  })

  it('(e) main does not have max-w-7xl (bare mode)', () => {
    render()
    const main = screen.getByRole('main')
    expect(main.className).not.toContain('max-w-7xl')
  })

  it('(f) last nav link is public site with correct label and href', () => {
    render()
    const nav = screen.getByRole('navigation', { name: fixture.navLabel })
    const publicLink = within(nav).getByRole('link', { name: fixture.publicSiteLabel })
    expect(publicLink).toHaveAttribute('href', '/')
  })
})

describe('WorkspaceShell – extra role coverage', () => {
  const matrixRoutes = [
    {
      element: <WorkspaceShell />,
      children: [{ path: '*', element: <h1>Trang bên trong</h1> }],
    },
    { path: '/login', element: <h1>Trang đăng nhập</h1> },
    { path: '/', element: <h1>Trang chủ</h1> },
  ]

  it('custom role with task:execute gets Công việc được giao link with svg', () => {
    const me = { ...ME, role: 'CUSTOM_ROLE', permissions: ['task:execute'], fullName: 'Custom' }
    renderWithAuth(matrixRoutes, {
      path: '/staff/tasks',
      auth: { me, status: 'authenticated' },
    })
    const nav = screen.getByRole('navigation', { name: 'Menu nhân viên' })
    const link = within(nav).getByRole('link', { name: 'Công việc được giao' })
    expect(link).toHaveAttribute('href', '/staff/tasks')
    expect(link.querySelector('svg')).toBeTruthy()
    expect(screen.getByText(/Khu làm việc CUSTOM_ROLE/)).toBeInTheDocument()
  })

  it('customer does not see any staff/manager/reception/operations links', () => {
    const me = { ...ME, role: 'CUSTOMER', fullName: 'Khách' }
    renderWithAuth(matrixRoutes, {
      path: '/my-bookings',
      auth: { me, status: 'authenticated' },
    })
    const nav = screen.getByRole('navigation', { name: 'Menu khách hàng' })
    const hrefs = within(nav)
      .getAllByRole('link')
      .map((l) => l.getAttribute('href') ?? '')
    const forbidden = hrefs.filter((h) =>
      ['/manager', '/reception', '/staff', '/operations'].some((prefix) => h.startsWith(prefix)),
    )
    expect(forbidden).toHaveLength(0)
  })

  it('staff navigating to /profile stays in the workspace shell', () => {
    renderWithAuth(matrixRoutes, {
      path: '/profile',
      auth: { me: { ...ME, role: 'MANAGER', fullName: 'Manager' }, status: 'authenticated' },
    })
    expect(screen.getByRole('navigation', { name: 'Menu nhân viên' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Trang bên trong' })).toBeInTheDocument()
  })
})
