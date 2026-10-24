import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from './auth-context'

// shortcut: menu tạm theo role, chuyển vào layout theo role khi có H10 (Khoa).
const ROLE_LINKS: Record<string, { to: string; label: string }[]> = {
  CUSTOMER: [
    { to: '/customer/service-orders', label: 'Dịch vụ của tôi' },
    { to: '/customer/service-orders/new', label: 'Yêu cầu dịch vụ' },
    { to: '/customer/issues', label: 'Sự cố của tôi' },
    { to: '/customer/issues/report', label: 'Báo sự cố' },
  ],
  MANAGER: [
    { to: '/manager/issues', label: 'Danh sách sự cố' },
    { to: '/manager/rooms', label: 'Phòng' },
    { to: '/manager/room-types', label: 'Loại phòng' },
    { to: '/manager/amenities', label: 'Tiện nghi' },
    { to: '/manager/services', label: 'Dịch vụ' },
    { to: '/manager/accounts', label: 'Tài khoản' },
    { to: '/manager/roles', label: 'Vai trò' },
    { to: '/staff/feedback', label: 'Phản hồi' },
  ],
  RECEPTIONIST: [
    { to: '/staff/service-orders', label: 'Yêu cầu dịch vụ' },
    { to: '/staff/issues', label: 'Yêu cầu sự cố' },
    { to: '/staff/feedback', label: 'Phản hồi' },
  ],
  SERVICE_STAFF: [
    { to: '/staff/service/dashboard', label: 'Bảng điều khiển dịch vụ' },
    { to: '/staff/service-history', label: 'Lịch sử thực hiện dịch vụ' },
  ],
  OPERATIONS_STAFF: [{ to: '/staff/operations/dashboard', label: 'Bảng điều khiển vận hành' }],
}

/** Góc phải header: link đăng nhập, hoặc tên người dùng + đăng xuất (UC03). */
export function UserMenu() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  if (!me) {
    return (
      <Link to="/login" className="hover:text-primary">
        Đăng nhập
      </Link>
    )
  }

  async function onLogout() {
    setError('')
    try {
      await logout()
      navigate('/login')
    } catch {
      setError('Đăng xuất không thành công, vui lòng thử lại')
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-4">
      {ROLE_LINKS[me.role]?.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="inline-flex min-h-11 items-center hover:text-primary"
        >
          {link.label}
        </Link>
      ))}
      {(['SERVICE_STAFF', 'OPERATIONS_STAFF'].includes(me.role) ||
        me.permissions.includes('task:execute')) && (
        <Link to="/staff/tasks" className="inline-flex min-h-11 items-center hover:text-primary">
          Công việc được giao
        </Link>
      )}
      <Link to="/profile" className="tracking-normal text-pearl-900 normal-case hover:text-primary">
        {me.fullName}
      </Link>
      <button type="button" onClick={onLogout} className="uppercase hover:text-primary">
        Đăng xuất
      </button>
      {error && (
        <span role="alert" className="text-danger normal-case">
          {error}
        </span>
      )}
    </span>
  )
}
