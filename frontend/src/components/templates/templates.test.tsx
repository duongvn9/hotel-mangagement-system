import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  it('marks the matching item active on a nested path and opens its group', () => {
    renderWorkspace('/staff/rooms/123')
    expect(screen.getByRole('link', { name: /^Phòng$/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Loại phòng/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: /Khách sạn/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('button', { name: /Phân tích/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('toggles a group when its heading is pressed', () => {
    renderWorkspace('/staff/rooms')
    const heading = screen.getByRole('button', { name: /Phân tích/ })
    fireEvent.click(heading)
    expect(heading).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(heading)
    expect(heading).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders the page content', () => {
    renderWorkspace('/staff/rooms')
    expect(screen.getByText('Nội dung trang')).toBeInTheDocument()
  })

  it('shows the unauthorized page instead of the content when forbidden', () => {
    renderWorkspace('/staff/rooms', { forbidden: true })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Cánh cửa này dành cho bộ phận khác',
    )
    expect(screen.queryByText('Nội dung trang')).not.toBeInTheDocument()
  })

  it('shows skeletons and no navigation while loading', () => {
    const { container } = renderWorkspace('/staff/rooms', { loading: true })
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /Phòng/ })).not.toBeInTheDocument()
  })

  it('opens the mobile drawer and closes it when a link inside is followed', async () => {
    renderWorkspace('/staff/rooms')
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('link', { name: /Loại phòng/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('calls onLogout from the user menu', async () => {
    const onLogout = vi.fn()
    renderWorkspace('/staff/rooms', { onLogout })
    fireEvent.keyDown(screen.getByRole('button', { name: /Trịnh Hải Yến/ }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: /Đăng xuất/ }))
    expect(onLogout).toHaveBeenCalledTimes(1)
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

  // (g) brand="Grand Emily HMS" hiển thị trong header và vòng tròn chữ là G
  it('renders custom brand in header with initial letter in the badge', () => {
    render(
      <MemoryRouter>
        <SiteLayout links={links} brand="Grand Emily HMS">
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Grand Emily HMS')).toBeInTheDocument()
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
})

describe('templates barrel', () => {
  it('re-exports the layouts', () => {
    for (const name of ['SiteLayout', 'WorkspaceLayout', 'AuthLayout', 'isNavActive']) {
      expect(templates).toHaveProperty(name)
    }
  })
})
