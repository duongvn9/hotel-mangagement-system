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

  it('renders the navigation, actions, content and footer', () => {
    render(
      <MemoryRouter>
        <SiteLayout links={links} actions={<button>Đăng nhập</button>}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    for (const link of screen.getAllByRole('link', { name: 'Phòng & suite' })) {
      expect(link).toHaveAttribute('href', '/rooms')
    }
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument()
    expect(screen.getByText('Nội dung')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('overlays the header on the page when asked', () => {
    render(
      <MemoryRouter>
        <SiteLayout links={links} overlay>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    expect(screen.getByRole('banner')).toHaveClass('absolute')
  })

  it('opens and closes the mobile menu', () => {
    render(
      <MemoryRouter>
        <SiteLayout links={links}>
          <p>Nội dung</p>
        </SiteLayout>
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link', { name: 'Phòng & suite' })).toHaveLength(2) // header + footer
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    expect(screen.getAllByRole('link', { name: 'Phòng & suite' })).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }))
    expect(screen.getAllByRole('link', { name: 'Phòng & suite' })).toHaveLength(2)
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
