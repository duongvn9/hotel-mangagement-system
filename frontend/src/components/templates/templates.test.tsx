import { fireEvent, render, screen, within } from '@testing-library/react'
import { BedDouble, LayoutDashboard } from 'lucide-react'
import { MemoryRouter } from 'react-router'
import * as templates from '.'
import { AuthLayout } from './AuthLayout'
import { SiteLayout } from './SiteLayout'
import { isNavActive } from './nav'
import { WorkspaceLayout, type NavGroup } from './WorkspaceLayout'

const groups: NavGroup[] = [
  {
    title: 'Khách sạn',
    items: [
      { to: '/staff/rooms', label: 'Phòng', icon: BedDouble },
      { to: '/staff/room-types', label: 'Loại phòng', icon: BedDouble },
    ],
  },
  {
    title: 'Phân tích',
    items: [{ to: '/staff/revenue', label: 'Doanh thu', icon: LayoutDashboard }],
  },
]

const user = { name: 'Trịnh Hải Yến', roleLabel: 'Lễ tân' }

function renderWorkspace(path: string, props: Partial<Parameters<typeof WorkspaceLayout>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WorkspaceLayout
        groups={groups}
        user={user}
        workspaceLabel="Lễ tân"
        onLogout={() => {}}
        {...props}
      >
        <p>Nội dung trang</p>
      </WorkspaceLayout>
    </MemoryRouter>,
  )
}

describe('isNavActive', () => {
  it('matches the exact path and nested paths but not look-alike prefixes', () => {
    expect(isNavActive('/staff/rooms/123', '/staff/rooms')).toBe(true)
    expect(isNavActive('/staff/rooms-extra', '/staff/rooms')).toBe(false)
    expect(isNavActive('/staff', '/staff')).toBe(true)
  })
})

describe('WorkspaceLayout', () => {
  it('(a) renders skip-link href="#main" and main element with id="main" tabIndex=-1', () => {
    renderWorkspace('/staff/rooms')
    const skipLink = screen.getByRole('link', { name: 'Bỏ qua điều hướng' })
    expect(skipLink).toHaveAttribute('href', '#main')
    expect(skipLink).toHaveClass('sr-only')
    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main')
    expect(main).toHaveAttribute('tabIndex', '-1')
  })

  it('(b) renders exactly one navigation labeled navLabel even when drawer is opened', () => {
    renderWorkspace('/staff/rooms', { navLabel: 'Menu nhân viên' })
    expect(screen.getAllByRole('navigation', { name: 'Menu nhân viên' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    expect(screen.getAllByRole('navigation', { name: 'Menu nhân viên' })).toHaveLength(1)
  })

  it('(c) toggles mobile drawer with Mở menu and Đóng menu overlay button', () => {
    renderWorkspace('/staff/rooms', { sidebarId: 'staff-sidebar' })
    const openBtn = screen.getByRole('button', { name: 'Mở menu' })
    expect(openBtn).toHaveAttribute('aria-expanded', 'false')
    expect(openBtn).toHaveAttribute('aria-controls', 'staff-sidebar')

    fireEvent.click(openBtn)
    expect(openBtn).toHaveAttribute('aria-expanded', 'true')
    const closeBtn = screen.getByRole('button', { name: 'Đóng menu' })
    expect(closeBtn).toBeInTheDocument()

    fireEvent.click(closeBtn)
    expect(openBtn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Đóng menu' })).not.toBeInTheDocument()
  })

  it('(d) closes on Escape and returns focus to Mở menu button', () => {
    renderWorkspace('/staff/rooms')
    const openBtn = screen.getByRole('button', { name: 'Mở menu' })
    fireEvent.click(openBtn)
    expect(openBtn).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(openBtn).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(openBtn)
  })

  it('(e) closes mobile drawer when a nav link is followed', () => {
    renderWorkspace('/staff/rooms')
    const openBtn = screen.getByRole('button', { name: 'Mở menu' })
    fireEvent.click(openBtn)
    expect(openBtn).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('link', { name: /Loại phòng/ }))
    expect(openBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('(f) aside has class invisible when closed and not when open', () => {
    const { container } = renderWorkspace('/staff/rooms', { sidebarId: 'my-sidebar' })
    const aside = container.querySelector('#my-sidebar')
    expect(aside).toHaveClass('invisible')

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    expect(aside).not.toHaveClass('invisible')
  })

  it('(g) marks matching item active, expands its group, and collapses/expands on header toggle', () => {
    renderWorkspace('/staff/rooms/123')
    expect(screen.getByRole('link', { name: /^Phòng$/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Loại phòng/ })).not.toHaveAttribute('aria-current')
    const hotelGroup = screen.getByRole('button', { name: /Khách sạn/ })
    const analyticsGroup = screen.getByRole('button', { name: /Phân tích/ })
    expect(hotelGroup).toHaveAttribute('aria-expanded', 'true')
    expect(analyticsGroup).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(analyticsGroup)
    expect(analyticsGroup).toHaveAttribute('aria-expanded', 'true')
  })

  it('(h) displays emptyNavText when groups is empty, or nothing when emptyNavText is omitted', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/staff']}>
        <WorkspaceLayout
          groups={[]}
          user={user}
          workspaceLabel="Lễ tân"
          onLogout={() => {}}
          emptyNavText="Chưa có mục menu"
        />
      </MemoryRouter>,
    )
    const nav = screen.getByRole('navigation')
    expect(within(nav).getByText('Chưa có mục menu')).toBeInTheDocument()

    rerender(
      <MemoryRouter initialEntries={['/staff']}>
        <WorkspaceLayout groups={[]} user={user} workspaceLabel="Lễ tân" onLogout={() => {}} />
      </MemoryRouter>,
    )
    expect(
      within(screen.getByRole('navigation')).queryByText('Chưa có mục menu'),
    ).not.toBeInTheDocument()
  })

  it('(i) renders public site link with custom label inside nav when publicSiteTo is provided', () => {
    const { rerender } = renderWorkspace('/staff/rooms', {
      publicSiteTo: '/',
      publicSiteLabel: 'Xem trang khách',
    })
    const nav = screen.getByRole('navigation')
    const publicLink = within(nav).getByRole('link', { name: /Xem trang khách/ })
    expect(publicLink).toHaveAttribute('href', '/')

    rerender(
      <MemoryRouter initialEntries={['/staff/rooms']}>
        <WorkspaceLayout groups={groups} user={user} workspaceLabel="Lễ tân" onLogout={() => {}} />
      </MemoryRouter>,
    )
    expect(
      within(screen.getByRole('navigation')).queryByRole('link', { name: /Xem trang khách/ }),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation')).queryByRole('link', { name: /Trang web công khai/ }),
    ).not.toBeInTheDocument()
  })

  it('(j) renders brand and workspaceLabel in header', () => {
    renderWorkspace('/staff/rooms', {
      brand: 'Grand Emily HMS',
      workspaceLabel: 'Quản lý',
    })
    const header = screen.getByRole('banner')
    expect(within(header).getByText(/Grand Emily HMS/)).toBeInTheDocument()
    expect(within(header).getByText(/Khu làm việc Quản lý/)).toBeInTheDocument()
  })

  it('(k) opens user menu on Enter with roleLabel, profile link, and logout action', async () => {
    const onLogout = vi.fn()
    const customUser = { name: 'Hoàng Thị Quản Lý', roleLabel: 'Quản lý' }
    const { rerender } = renderWorkspace('/staff/rooms', {
      user: customUser,
      onLogout,
      profileTo: '/profile',
    })
    const trigger = screen.getByRole('button', { name: 'Hoàng Thị Quản Lý' })
    fireEvent.keyDown(trigger, { key: 'Enter' })

    expect(await screen.findByRole('menuitem', { name: /Hồ sơ & cài đặt/ })).toHaveAttribute(
      'href',
      '/profile',
    )
    expect(screen.getByText('Quản lý')).toBeInTheDocument()
    const logoutItem = screen.getByRole('menuitem', { name: /Đăng xuất/ })
    fireEvent.click(logoutItem)
    expect(onLogout).toHaveBeenCalledTimes(1)

    rerender(
      <MemoryRouter initialEntries={['/staff/rooms']}>
        <WorkspaceLayout
          groups={groups}
          user={customUser}
          workspaceLabel="Quản lý"
          onLogout={onLogout}
        />
      </MemoryRouter>,
    )
    const newTrigger = screen.getByRole('button', { name: 'Hoàng Thị Quản Lý' })
    fireEvent.keyDown(newTrigger, { key: 'Enter' })
    expect(await screen.findByRole('menuitem', { name: /Đăng xuất/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Hồ sơ & cài đặt/ })).not.toBeInTheDocument()
  })

  it('(l) handles long names with truncate, fallback to last word initial, and avatarUrl', () => {
    const longName = 'Nguyễn Đặng Phương Thảo '.repeat(3).trim() + ' An' // > 80 chars
    const { rerender } = renderWorkspace('/staff/rooms', {
      user: { name: longName, roleLabel: 'Nhân viên' },
    })
    const trigger = screen.getByRole('button', { name: longName })
    const nameSpan = trigger.querySelector('.truncate')
    expect(nameSpan).toBeInTheDocument()
    expect(nameSpan).toHaveTextContent(longName)
    expect(screen.getByText('A')).toBeInTheDocument()

    expect(() => {
      rerender(
        <MemoryRouter initialEntries={['/staff/rooms']}>
          <WorkspaceLayout
            groups={groups}
            user={{
              name: 'Trần Văn Bình',
              roleLabel: 'Nhân viên',
              avatarUrl: 'https://example.com/avatar.jpg',
            }}
            workspaceLabel="Nhân viên"
            onLogout={() => {}}
          />
        </MemoryRouter>,
      )
    }).not.toThrow()
    expect(screen.getByRole('button', { name: 'Trần Văn Bình' })).toBeInTheDocument()
  })

  it('(m) displays error message in an alert below header', () => {
    renderWorkspace('/staff/rooms', { error: 'Đăng xuất không thành công' })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Đăng xuất không thành công')
    expect(alert).toHaveClass('text-destructive')
  })

  it('(n) shows skeleton and status text while loading without rendering navigation', () => {
    renderWorkspace('/staff/rooms', { loading: true, loadingLabel: 'Đang tải dữ liệu…' })
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Đang tải dữ liệu…')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('(o) toggles contentWidth between contained and bare', () => {
    const { rerender } = renderWorkspace('/staff/rooms', { contentWidth: 'bare' })
    const main = screen.getByRole('main')
    expect(main).not.toHaveClass('max-w-7xl')
    expect(main).not.toHaveClass('sm:px-8')

    rerender(
      <MemoryRouter initialEntries={['/staff/rooms']}>
        <WorkspaceLayout groups={groups} user={user} workspaceLabel="Lễ tân" onLogout={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('main')).toHaveClass('max-w-7xl', 'sm:px-8')
  })

  it('(p) renders Unauthorized instead of children when forbidden is true', () => {
    renderWorkspace('/staff/rooms', { forbidden: true })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Cánh cửa này dành cho bộ phận khác',
    )
    expect(screen.queryByText('Nội dung trang')).not.toBeInTheDocument()
  })
})

describe('SiteLayout', () => {
  const links = [
    { to: '/', label: 'Trang chủ' },
    { to: '/rooms', label: 'Phòng & suite' },
  ]

  // (a) getAllByRole('link', { name: 'Phòng & suite' }) có đúng 2 phần tử khi footerLinks chứa link đó (header + footer) và đúng 1 khi không có footerLinks
  it('renders links in header and only duplicates to footer when footerLinks contains it', () => {
    const { rerender } = render(
      <MemoryRouter>
        <SiteLayout links={links} footerLinks={[{ to: '/rooms', label: 'Phòng & suite' }]}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link', { name: 'Phòng & suite' })).toHaveLength(2)

    rerender(
      <MemoryRouter>
        <SiteLayout links={links}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link', { name: 'Phòng & suite' })).toHaveLength(1)
  })

  // (b) getByRole('navigation', { name: 'Menu chính' }) tồn tại, navLabel="Menu" đổi tên
  it('renders a single navigation labeled with navLabel', () => {
    const { rerender } = render(
      <MemoryRouter>
        <SiteLayout links={links}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('navigation', { name: 'Menu chính' })).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <SiteLayout links={links} navLabel="Menu">
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('navigation', { name: 'Menu' })).toBeInTheDocument()
  })

  // (c) skip-link getByRole('link', { name: 'Bỏ qua điều hướng' }) có href="#main" và getByRole('main') có id="main"
  it('provides a skip link pointing to main landmark with id="main"', () => {
    render(
      <MemoryRouter>
        <SiteLayout links={links}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    const skipLink = screen.getByRole('link', { name: 'Bỏ qua điều hướng' })
    expect(skipLink).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  // (d) nút Mở menu có aria-expanded="false", bấm → "true" và aria-controls trỏ tới nav
  it('controls main nav expansion with aria-expanded and aria-controls on the toggle button', () => {
    render(
      <MemoryRouter>
        <SiteLayout links={links}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    const button = screen.getByRole('button', { name: 'Mở menu' })
    const nav = screen.getByRole('navigation', { name: 'Menu chính' })
    expect(nav).toHaveAttribute('id', 'main-nav')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-controls', 'main-nav')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  // (e) khi menu mở, nhấn Escape (keyDown trên document) → aria-expanded="false" và nút Mở menu đang document.activeElement
  it('closes mobile menu on Escape keydown and restores focus to toggle button', () => {
    render(
      <MemoryRouter>
        <SiteLayout links={links}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    const button = screen.getByRole('button', { name: 'Mở menu' })
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(button)
  })

  // (f) render lại bằng MemoryRouter đổi route (bấm link trong nav) → aria-expanded="false"
  it('closes mobile menu when route changes via clicking a nav link', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SiteLayout links={links}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    const button = screen.getByRole('button', { name: 'Mở menu' })
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')

    const nav = screen.getByRole('navigation', { name: 'Menu chính' })
    fireEvent.click(within(nav).getByRole('link', { name: 'Phòng & suite' }))
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  // (g) brand="Grand Emily Hotel" hiển thị trong header và vòng tròn chữ là G
  it('renders custom brand in header with initial letter in the badge', () => {
    render(
      <MemoryRouter>
        <SiteLayout links={links} brand="Grand Emily Hotel">
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Grand Emily Hotel')).toBeInTheDocument()
    expect(within(banner).getByText('G')).toBeInTheDocument()
  })

  // (h) Link đang ở trang hiện tại có aria-current="page", / chỉ active khi pathname === '/'
  it('marks active link with aria-current="page" and only activates / on root path', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <SiteLayout links={links}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Phòng & suite' })).not.toHaveAttribute('aria-current')

    unmount()

    render(
      <MemoryRouter initialEntries={['/rooms']}>
        <SiteLayout links={links}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Trang chủ' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Phòng & suite' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

describe('AuthLayout', () => {
  it('shows the title, subtitle and form content', () => {
    render(
      <MemoryRouter>
        <AuthLayout title="Đăng nhập" subtitle="Chào mừng bạn quay lại">
          <form aria-label="login" />
        </AuthLayout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
    expect(screen.getByText('Chào mừng bạn quay lại')).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'login' })).toBeInTheDocument()
  })

  it('passes brand name down to the logo', () => {
    render(
      <MemoryRouter>
        <AuthLayout title="Đăng nhập" subtitle="Chào mừng" brand="Grand Emily Hotel">
          <div />
        </AuthLayout>
      </MemoryRouter>,
    )
    expect(screen.getByText('Grand Emily Hotel')).toBeInTheDocument()
  })
})

describe('templates barrel', () => {
  it('re-exports the layouts', () => {
    for (const name of ['SiteLayout', 'WorkspaceLayout', 'AuthLayout', 'isNavActive']) {
      expect(templates).toHaveProperty(name)
    }
  })
})
