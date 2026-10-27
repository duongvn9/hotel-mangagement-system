import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { navGroupsFor } from '@/app/navigation'
import { ROLE_LABELS } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { env } from '@/lib/env'
import { PublicLayout } from './PublicLayout'
import { StaffNav } from './StaffNav'

/**
 * Khung làm việc của nhân viên: thanh bên theo nhóm (264px, thu thành ngăn kéo dưới 1024px) và
 * thanh trên có người dùng. Khách chưa đăng nhập được chuyển về đăng nhập; Customer vào nhầm khu
 * nhân viên vẫn dùng khung khách. Quyền vào từng trang do RequireAuth của route quyết định.
 */
export function StaffLayout() {
  const { me, status, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  // Ngăn kéo gắn với trang đang mở nên tự đóng khi chuyển trang.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const [error, setError] = useState('')
  const toggleRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const open = openOn === location.pathname

  useEffect(() => {
    if (!open) return
    sidebarRef.current?.querySelector('a')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpenOn(null)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (status === 'loading') {
    return <p className="px-4 py-24 text-center text-stone-700">Đang tải…</p>
  }
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (me.role === 'CUSTOMER') return <PublicLayout />

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
    <div className="min-h-screen bg-cream-100 lg:grid lg:grid-cols-[264px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-pearl-900"
      >
        Bỏ qua điều hướng
      </a>

      <aside
        id="staff-sidebar"
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-pearl-900 text-cream-100 transition-transform duration-200 ease-out motion-reduce:transition-none lg:visible lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <Link
          to="/"
          className="flex h-16 shrink-0 items-center border-b border-pearl-700 px-6 font-display text-2xl font-semibold text-white"
        >
          {env.appName}
        </Link>
        <StaffNav groups={navGroupsFor(me)} />
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Đóng menu"
          tabIndex={-1}
          onClick={() => setOpenOn(null)}
          className="fixed inset-0 z-30 bg-pearl-900/50 lg:hidden"
        />
      )}

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-stone-300 bg-white px-4 md:px-8">
          <button
            type="button"
            ref={toggleRef}
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls="staff-sidebar"
            onClick={() => setOpenOn(open ? null : location.pathname)}
            className="inline-flex size-11 items-center justify-center rounded text-pearl-900 transition-colors duration-150 hover:bg-stone-200 motion-reduce:transition-none lg:hidden"
          >
            <span aria-hidden className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
            </span>
          </button>
          <div className="ml-auto flex min-w-0 items-center gap-4">
            <div className="flex min-w-0 flex-col items-end leading-tight">
              <Link
                to="/profile"
                className="max-w-[40vw] truncate text-sm font-medium text-pearl-900 hover:text-primary sm:max-w-xs"
              >
                {me.fullName}
              </Link>
              <span className="text-xs text-stone-700">{ROLE_LABELS[me.role] ?? me.role}</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-11 items-center rounded px-3 text-sm font-semibold tracking-wider text-stone-700 uppercase transition-colors duration-150 hover:bg-stone-200 hover:text-pearl-900 motion-reduce:transition-none"
            >
              Đăng xuất
            </button>
          </div>
        </header>
        {error && (
          <p role="alert" className="bg-danger-bg px-4 py-2 text-sm text-danger md:px-8">
            {error}
          </p>
        )}
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
