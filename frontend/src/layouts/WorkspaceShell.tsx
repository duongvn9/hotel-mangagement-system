import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { shellGroupsFor } from '@/app/workspace-nav'
import { WorkspaceLayout } from '@/components/templates'
import { ROLE_LABELS } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { env } from '@/lib/env'

/**
 * Khung làm việc dùng chung cho mọi vai trò (nhân viên và tài khoản khách):
 * thanh bên thương hiệu theo nhóm và thanh trên có menu người dùng. Khách chưa
 * đăng nhập được chuyển về đăng nhập. Quyền vào từng trang do RequireAuth của
 * route quyết định.
 */
export function WorkspaceShell() {
  const { me, status, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  if (status === 'loading') {
    return (
      <WorkspaceLayout
        loading
        loadingLabel="Đang tải…"
        groups={[]}
        user={{ name: '', roleLabel: '' }}
        workspaceLabel=""
        onLogout={() => {}}
      />
    )
  }

  if (!me) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const customer = me.role === 'CUSTOMER'
  const roleLabel = ROLE_LABELS[me.role] ?? me.role

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
    <WorkspaceLayout
      sidebarId="staff-sidebar"
      brand={env.appName}
      navLabel={customer ? 'Menu khách hàng' : 'Menu nhân viên'}
      emptyNavText="Chưa có mục menu cho vai trò này. Liên hệ quản lý để được cấp quyền."
      groups={shellGroupsFor(me)}
      user={{ name: me.fullName, roleLabel, avatarUrl: me.avatarUrl }}
      workspaceLabel={roleLabel}
      profileTo="/profile"
      publicSiteTo="/"
      publicSiteLabel={customer ? 'Về trang chủ' : 'Xem trang khách'}
      contentWidth="bare"
      error={error}
      onLogout={onLogout}
    />
  )
}
