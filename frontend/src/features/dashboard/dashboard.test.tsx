import { isValidElement } from 'react'
import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { matchRoutes } from 'react-router'
import { focusManager } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { UserMenu } from '@/features/auth/UserMenu'
import { router as actualRouter } from '@/app/router'
import { dashboardRoutes } from './routes'
import { MANAGER_SHORTCUTS } from './shortcuts'
import type { ManagerDashboard } from './api'
const root = '/manager/dashboard'
const data: ManagerDashboard = {
  generatedAt: '2026-11-01T03:15:00Z',
  tasks: { available: true, counts: { assigned: 1200, inProgress: 4, completed: 8 }, overdue: 2 },
  rooms: {
    available: true,
    asOf: '2026-11-01T03:15:00Z',
    activeTotal: 12,
    byStatus: { AVAILABLE: 3, OCCUPIED: 5, CLEANING: 2, MAINTENANCE: 2 },
  },
  revenue: {
    available: true,
    period: { from: '2026-11-01', to: '2026-11-01', timezone: 'Asia/Ho_Chi_Minh' },
    successAmount: 1234567,
    successCount: 2,
  },
}
function renderPage(role = 'MANAGER') {
  return renderWithAuth([...dashboardRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
    path: root,
    auth: {
      me: { ...ME, role, permissions: ['report:view', 'facility:manage'] },
      status: 'authenticated',
    },
  })
}
const region = (name: string) => within(screen.getByRole('region', { name }))
function actualMatch(to: string) {
  return matchRoutes(actualRouter.routes, to)?.at(-1)?.route
}
describe('Manager Dashboard', () => {
  beforeAll(() => configure({ asyncUtilTimeout: 5000 }))
  afterAll(() => {
    configure({ asyncUtilTimeout: 1000 })
    actualRouter.dispose()
  })
  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue({ data })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    focusManager.setFocused(undefined)
  })
  it('shows only existing summary definitions with Vietnamese formatting and correct card links', async () => {
    renderPage()
    await screen.findByText('1.234.567 ₫')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Tổng quan' })).toBeInTheDocument()
    const tasks = region('Hàng đợi task')
    expect(tasks.getByText('1.200')).toBeInTheDocument()
    expect(tasks.getByText('Đã giao')).toBeInTheDocument()
    expect(tasks.getByText('Quá hạn: 2')).toBeInTheDocument()
    expect(tasks.getByRole('link', { name: 'Xem hàng đợi task' })).toHaveAttribute(
      'href',
      '/manager/task-queues',
    )
    const rooms = region('Trạng thái phòng')
    for (const label of ['Trống', 'Có khách', 'Đang dọn', 'Bảo trì'])
      expect(rooms.getByText(label)).toBeInTheDocument()
    expect(rooms.getByRole('link', { name: 'Xem phòng' })).toHaveAttribute('href', '/manager/rooms')
    const revenue = region('Thực thu tháng này')
    expect(revenue.getByText('Thực thu (giao dịch thành công)')).toBeInTheDocument()
    expect(revenue.getByText('Giao dịch thành công: 2')).toBeInTheDocument()
    expect(revenue.getByText('01/11/2026–01/11/2026')).toBeInTheDocument()
    expect(revenue.getByRole('link', { name: 'Xem báo cáo doanh thu' })).toHaveAttribute(
      'href',
      '/manager/reports/revenue?from=2026-11-01&to=2026-11-01&granularity=day',
    )
    expect(screen.getByText('Cập nhật lúc 10:15')).toHaveAttribute('aria-live', 'polite')
    expect(api.get).toHaveBeenCalledWith('/dashboard/manager')
    for (const forbidden of ['ADR', 'RevPAR', 'Booking', 'Tỷ lệ lấp đầy', 'Xuất'])
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument()
  })
  it('validates every shortcut against the actual application router and Manager access', async () => {
    renderPage()
    await screen.findByText('1.234.567 ₫')
    const links = within(screen.getByRole('navigation', { name: 'Lối tắt' })).getAllByRole('link')
    expect(links).toHaveLength(10)
    for (const link of links) {
      const route = actualMatch(link.getAttribute('href')!)
      expect(route?.path).not.toBe('*')
      expect(route).toBeDefined()
      expect(isValidElement(route?.element)).toBe(true)
      if (isValidElement<{ roles: string[] }>(route?.element))
        expect(route.element.props.roles).toContain('MANAGER')
    }
    for (const group of MANAGER_SHORTCUTS)
      for (const link of group.links)
        expect(links.some((element) => element.getAttribute('href') === link.to)).toBe(true)
  })
  it('contains no link to a nonexistent report or another role-only screen', async () => {
    renderPage()
    await screen.findByText('1.234.567 ₫')
    expect(actualMatch('/manager/reports/operations')?.path).toBe('*')
    expect(actualMatch('/manager/not-a-real-screen')?.path).toBe('*')
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href')!
      expect(actualMatch(href)?.path).not.toBe('*')
      expect(href).not.toContain('/operations/')
      expect(href).not.toContain('/customer/')
      expect(href).not.toContain('/staff/service/')
    }
    expect(screen.queryByRole('link', { name: 'Báo cáo vận hành' })).not.toBeInTheDocument()
  })
  it.each(['tasks', 'rooms', 'revenue'] as const)(
    'keeps other cards available when %s fails and retries all summaries',
    async (name) => {
      vi.mocked(api.get)
        .mockResolvedValueOnce({ data: { ...data, [name]: { available: false, reason: 'error' } } })
        .mockResolvedValue({ data })
      renderPage()
      await screen.findByRole('button', { name: 'Thử lại' })
      const title = {
        tasks: 'Hàng đợi task',
        rooms: 'Trạng thái phòng',
        revenue: 'Thực thu tháng này',
      }[name]
      expect(region(title).getByRole('alert')).toHaveTextContent('Không tải được số liệu')
      if (name !== 'revenue') expect(screen.getByText('1.234.567 ₫')).toBeInTheDocument()
      if (name !== 'tasks') expect(screen.getByText('1.200')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument(),
      )
      expect(api.get).toHaveBeenCalledTimes(2)
    },
  )
  it.each(['tasks', 'rooms', 'revenue'] as const)(
    'shows explicit missing-source placeholder for %s without substituting zero',
    async (name) => {
      vi.mocked(api.get).mockResolvedValue({
        data: { ...data, [name]: { available: false, reason: 'not_available' } },
      })
      renderPage()
      await screen.findByText('Chưa có dữ liệu nguồn')
      const title = {
        tasks: 'Hàng đợi task',
        rooms: 'Trạng thái phòng',
        revenue: 'Thực thu tháng này',
      }[name]
      const card = region(title)
      expect(card.queryByText('0')).not.toBeInTheDocument()
      expect(card.queryByRole('button')).not.toBeInTheDocument()
      expect(card.queryByRole('link')).not.toBeInTheDocument()
    },
  )
  it('renders actual zero values when all sources exist but are empty', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...data,
        tasks: {
          available: true,
          counts: { assigned: 0, inProgress: 0, completed: 0 },
          overdue: 0,
        },
        rooms: {
          available: true,
          asOf: data.generatedAt,
          activeTotal: 0,
          byStatus: { AVAILABLE: 0, OCCUPIED: 0, CLEANING: 0, MAINTENANCE: 0 },
        },
        revenue: {
          available: true,
          period: { from: '2026-11-01', to: '2026-11-01', timezone: 'Asia/Ho_Chi_Minh' },
          successCount: 0,
          successAmount: 0,
        },
      },
    })
    renderPage()
    expect(await screen.findByText('0 ₫')).toBeInTheDocument()
    expect(region('Hàng đợi task').getAllByText('0')).toHaveLength(3)
    expect(screen.queryByText('Chưa có dữ liệu nguồn')).not.toBeInTheDocument()
  })
  it('shows loading separately in every card and disables refresh while fetching', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}))
    renderPage()
    expect(screen.getAllByText('Đang tải…')).toHaveLength(3)
    for (const name of ['Hàng đợi task', 'Trạng thái phòng', 'Thực thu tháng này'])
      expect(region(name).getByRole('status')).toHaveTextContent('Đang tải')
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeDisabled()
  })
  it('uses the shared error message for endpoint failure and retries', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { data: { message: 'Dashboard tạm thời không truy cập được' } },
      })
      .mockResolvedValue({ data })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dashboard tạm thời không truy cập được',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByText('1.234.567 ₫')
  })
  it('refreshes counts and generatedAt with a polite announcement', async () => {
    renderPage()
    await screen.findByText('Cập nhật lúc 10:15')
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...data,
        generatedAt: '2026-11-01T03:16:00Z',
        tasks: {
          available: true,
          counts: { assigned: 1201, inProgress: 4, completed: 8 },
          overdue: 2,
        },
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    expect(await screen.findByText('Cập nhật lúc 10:16')).toBeInTheDocument()
    expect(screen.getByText('1.201')).toBeInTheDocument()
  })
  it('refetches a new snapshot on window focus', async () => {
    renderPage()
    await screen.findByText('1.234.567 ₫')
    const before = vi.mocked(api.get).mock.calls.length
    focusManager.setFocused(false)
    focusManager.setFocused(true)
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(before))
  })
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF', 'CUSTOM_REPORTER'])(
    'blocks %s even with report/facility permissions',
    async (role) => {
      renderPage(role)
      expect(
        await screen.findByRole('heading', { name: 'Không có quyền truy cập' }),
      ).toBeInTheDocument()
      expect(api.get).not.toHaveBeenCalled()
    },
  )
  it('redirects anonymous users to the existing login route', async () => {
    renderWithAuth([...dashboardRoutes, { path: '/login', element: <p>Đăng nhập test</p> }], {
      path: root,
    })
    expect(await screen.findByText('Đăng nhập test')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })
  it('adds the Manager menu entry without changing post-login navigation', () => {
    renderWithAuth([{ path: '/', element: <UserMenu /> }], {
      auth: { me: ME, status: 'authenticated' },
    })
    expect(screen.getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('href', root)
  })
})
