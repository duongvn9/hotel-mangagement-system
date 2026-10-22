import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './auth-context'

/** Chặn route khi chưa đăng nhập (về /login) hoặc sai role (BR-RBAC-03). */
export function RequireAuth({ roles, children }: { roles?: string[]; children: ReactNode }) {
  const { status, me } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <p className="px-4 py-16 text-center text-stone-700">Đang tải…</p>
  }
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(me.role)) {
    return (
      <section className="mx-auto max-w-container px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-semibold">Không có quyền truy cập</h1>
        <p className="mt-4 text-stone-700">Tài khoản của bạn không được dùng chức năng này.</p>
      </section>
    )
  }
  return children
}
