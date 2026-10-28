import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { UserMenu } from '@/features/auth/UserMenu'
import { env } from '@/lib/env'

const currentYear = new Date().getFullYear()

const LINKS = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/search', label: 'Đặt phòng', end: false },
  { to: '/my-bookings', label: 'Booking của tôi', end: false },
]

/** Khung cho khách và Customer: header gọn, dưới 768px menu thu sau nút mở. */
export function PublicLayout() {
  const location = useLocation()
  // Menu di động gắn với trang đang mở nên tự đóng khi chuyển trang.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === location.pathname
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpenOn(null)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-pearl-900"
      >
        Bỏ qua điều hướng
      </a>
      <header className="border-b border-stone-300 bg-cream-50">
        <div className="mx-auto flex min-h-16 max-w-container flex-wrap items-center justify-between gap-x-6 px-4 md:min-h-20">
          <Link to="/" className="font-display text-2xl font-semibold text-pearl-900">
            {env.appName}
          </Link>
          <button
            type="button"
            ref={toggleRef}
            aria-label="Mở menu"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpenOn(open ? null : location.pathname)}
            className="inline-flex size-11 items-center justify-center rounded text-pearl-900 transition-colors duration-150 hover:bg-stone-200 motion-reduce:transition-none md:hidden"
          >
            <span aria-hidden className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
              <span className="block h-0.5 w-5 bg-current" />
            </span>
          </button>
          <nav
            id="main-nav"
            aria-label="Menu chính"
            className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-1 pb-4 text-sm font-medium tracking-wide text-stone-700 uppercase md:flex md:w-auto md:flex-row md:items-center md:gap-6 md:pb-0`}
          >
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center underline-offset-8 transition-colors duration-150 motion-reduce:transition-none ${
                    isActive
                      ? 'text-pearl-900 underline decoration-gold-500 decoration-2'
                      : 'hover:text-primary'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <UserMenu compact />
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <footer className="bg-pearl-900 py-8 text-center text-sm text-stone-300">
        © {currentYear} {env.appName}
      </footer>
    </div>
  )
}
