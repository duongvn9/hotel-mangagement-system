import { fireEvent, screen } from '@testing-library/react'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { notificationsFor } from './mock'
import { notificationRoutes } from './routes'

const renderPage = (role: string | null) =>
  renderWithAuth([...notificationRoutes, { path: '/login', element: <p>đăng nhập</p> }], {
    path: '/notifications',
    auth: role
      ? { me: { ...ME, role }, status: 'authenticated' }
      : { me: null, status: 'anonymous' },
  })

describe('notifications (mock)', () => {
  it('only lists notifications meant for the signed-in role', () => {
    expect(notificationsFor('CUSTOMER').map((n) => n.title)).toEqual(['Đã xác nhận đặt cọc'])
    expect(notificationsFor('SERVICE_STAFF').map((n) => n.title)).toEqual([
      'Có yêu cầu dịch vụ mới',
    ])
    expect(notificationsFor('CUSTOM_ROLE')).toEqual([])
  })

  it('marks itself as a UX proposal and shows the role’s notifications', () => {
    renderPage('RECEPTIONIST')
    expect(screen.getByRole('heading', { level: 1, name: 'Thông báo' })).toBeInTheDocument()
    expect(screen.getByText('Đề xuất UX')).toBeInTheDocument()
    expect(screen.getByText('Đặt phòng trực tuyến mới')).toBeInTheDocument()
    expect(screen.getByText('Thanh toán chưa đối soát')).toBeInTheDocument()
    expect(screen.queryByText('Có yêu cầu dịch vụ mới')).not.toBeInTheDocument()
  })

  it('marks one notification read when it is clicked, and all with the header button', () => {
    renderPage('RECEPTIONIST')
    const first = screen.getByRole('button', { name: /Đặt phòng trực tuyến mới/ })
    expect(first).not.toHaveAttribute('data-read')
    fireEvent.click(first)
    expect(first).toHaveAttribute('data-read', 'true')
    const other = screen.getByRole('button', { name: /Thanh toán chưa đối soát/ })
    expect(other).not.toHaveAttribute('data-read')
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }))
    expect(other).toHaveAttribute('data-read', 'true')
  })

  it('shows an empty state when the role has nothing', () => {
    renderPage('CUSTOM_ROLE')
    expect(screen.getByText('Bạn đã xem hết thông báo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đặt phòng/ })).not.toBeInTheDocument()
  })

  it('sends visitors who are not signed in to the login page', () => {
    renderPage(null)
    expect(screen.getByText('đăng nhập')).toBeInTheDocument()
  })
})
