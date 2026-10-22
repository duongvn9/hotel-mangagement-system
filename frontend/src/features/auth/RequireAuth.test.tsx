import { screen } from '@testing-library/react'
import { RequireAuth } from './RequireAuth'
import { ME, renderWithAuth } from './test-utils'

const routes = [
  { path: '/login', element: <p>trang đăng nhập</p> },
  {
    path: '/admin',
    element: (
      <RequireAuth roles={['MANAGER']}>
        <p>nội dung quản lý</p>
      </RequireAuth>
    ),
  },
]

describe('RequireAuth', () => {
  it('chưa đăng nhập thì chuyển về /login', () => {
    renderWithAuth(routes, { path: '/admin' })
    expect(screen.getByText('trang đăng nhập')).toBeInTheDocument()
  })

  it('sai role thì báo không có quyền', () => {
    renderWithAuth(routes, {
      path: '/admin',
      auth: { me: { ...ME, role: 'CUSTOMER' }, status: 'authenticated' },
    })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('role khác nhưng có đủ permission thì vào được', () => {
    renderWithAuth(
      [
        {
          path: '/tasks',
          element: (
            <RequireAuth roles={['SERVICE_STAFF']} permissions={['task:execute']}>
              <p>công việc</p>
            </RequireAuth>
          ),
        },
      ],
      {
        path: '/tasks',
        auth: {
          me: { ...ME, role: 'HOUSEKEEPING', permissions: ['task:execute'] },
          status: 'authenticated',
        },
      },
    )
    expect(screen.getByText('công việc')).toBeInTheDocument()
  })

  it('đúng role thì hiển thị nội dung', () => {
    renderWithAuth(routes, { path: '/admin', auth: { me: ME, status: 'authenticated' } })
    expect(screen.getByText('nội dung quản lý')).toBeInTheDocument()
  })
})
