import { Link, Outlet } from 'react-router'
import { UserMenu } from '@/features/auth/UserMenu'
import { env } from '@/lib/env'

const currentYear = new Date().getFullYear()

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-300 bg-cream-50">
        <div className="mx-auto flex min-h-16 max-w-container flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="font-display text-2xl font-semibold text-pearl-900">
            {env.appName}
          </Link>
          <nav className="flex flex-wrap items-center gap-6 text-sm font-medium tracking-wide text-stone-700 uppercase">
            <Link to="/" className="hover:text-primary">
              Trang chủ
            </Link>
            <Link to="/search" className="hover:text-primary">
              Đặt phòng
            </Link>
            <Link to="/my-bookings" className="hover:text-primary">
              Booking của tôi
            </Link>
            <UserMenu />
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-pearl-900 py-8 text-center text-sm text-stone-300">
        © {currentYear} {env.appName}
      </footer>
    </div>
  )
}
