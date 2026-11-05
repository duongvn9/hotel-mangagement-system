import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { roleHome } from '@/app/navigation'
import { Unauthorized } from '@/components/organisms'
import { useAuth } from './auth-context'

interface RequireAuthProps {
  roles?: string[]
  /** Giống @Permissions() ở backend: role có đủ các permission này cũng được vào (UC45). */
  permissions?: string[]
  children: ReactNode
}

/** Chặn route khi chưa đăng nhập (về /login) hoặc không có quyền (BR-RBAC-03). */
export function RequireAuth({ roles, permissions, children }: RequireAuthProps) {
  const { status, me } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <p className="px-4 py-16 text-center text-muted-foreground">Đang tải…</p>
  }
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  const allowed =
    (!roles && !permissions) ||
    roles?.includes(me.role) ||
    (permissions?.length && permissions.every((p) => me.permissions.includes(p)))
  if (!allowed) {
    const isCustomer = me.role === 'CUSTOMER'
    return (
      <Unauthorized
        homeTo={isCustomer ? '/' : roleHome(me.role)}
        actionLabel={isCustomer ? 'Về trang chủ' : 'Về khu làm việc của tôi'}
        description="Vai trò hiện tại của bạn chưa được cấp quyền vào trang này."
      />
    )
  }
  return children
}
