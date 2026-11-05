import { AssetImage } from '@/components/AssetImage'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { flatLinks, isStaffRole, navGroupsFor, roleHome } from '@/app/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from './auth-context'

const compactLink =
  'inline-flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground md:min-h-0 md:rounded-full md:py-2 lg:px-4'

/**
 * Góc phải header: link đăng nhập, hoặc tên người dùng + đăng xuất (UC03).
 * Mặc định liệt kê mọi link của role theo hàng ngang. `compact` dùng cho header khách: Customer
 * gom các trang của mình vào một menu, nhân viên chỉ thấy nút "Khu làm việc".
 */
export function UserMenu({
  compact = false,
  overlay = false,
}: {
  compact?: boolean
  overlay?: boolean
}) {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  // Menu gắn với trang đang mở nên tự đóng khi chuyển trang.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === location.pathname
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpenOn(null)
      buttonRef.current?.focus()
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpenOn(null)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  if (!me) {
    return compact ? (
      <span className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
        <Link
          to="/login"
          className={cn(
            'inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors md:min-h-0 md:rounded-full lg:px-4',
            overlay
              ? 'text-ink-foreground hover:bg-card/15 hover:text-ink-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Đăng nhập
        </Link>
        <Link
          to="/search"
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 py-2 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 md:min-h-0"
        >
          Đặt phòng
        </Link>
      </span>
    ) : (
      <Link
        to="/login"
        className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
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

  const account = (
    <>
      <Link
        to="/profile"
        className={cn(
          compact
            ? compactLink
            : 'inline-flex min-h-11 items-center text-sm font-medium hover:text-primary',
          'tracking-normal normal-case',
          overlay ? 'text-ink-foreground hover:text-ink-foreground/80' : 'text-foreground',
        )}
      >
        <span className="inline-flex items-center gap-2">
          <AssetImage decorative path={me.avatarUrl} name={me.fullName} />
          {me.fullName}
        </span>
      </Link>
      <button
        type="button"
        onClick={onLogout}
        className={cn(
          compact
            ? `${compactLink} uppercase`
            : 'inline-flex min-h-11 items-center text-sm font-medium uppercase hover:text-foreground',
          overlay ? 'text-ink-foreground hover:text-ink-foreground/80' : 'text-muted-foreground',
        )}
      >
        Đăng xuất
      </button>
      {error && (
        <span role="alert" className="text-danger normal-case">
          {error}
        </span>
      )}
    </>
  )

  if (!compact) {
    return (
      <span className="flex flex-wrap items-center gap-4">
        {flatLinks(me).map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
        {account}
      </span>
    )
  }

  const groups = navGroupsFor(me)
  return (
    <span className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
      {isStaffRole(me.role) ? (
        <Link
          to={roleHome(me.role)}
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 py-2 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 md:min-h-0"
        >
          Vào khu làm việc
        </Link>
      ) : (
        groups.length > 0 && (
          <div ref={wrapperRef} className="relative">
            <button
              type="button"
              ref={buttonRef}
              aria-expanded={open}
              aria-controls="account-links"
              onClick={() => setOpenOn(open ? null : location.pathname)}
              className={cn(
                `${compactLink} gap-2 uppercase`,
                overlay
                  ? 'text-ink-foreground hover:text-ink-foreground/80'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {groups[0]?.label}
              <span aria-hidden className="text-xs">
                {open ? '▲' : '▼'}
              </span>
            </button>
            {open && (
              <ul
                id="account-links"
                className="mt-1 pl-3 md:absolute md:top-full md:right-0 md:z-30 md:mt-2 md:w-64 md:rounded-xl md:border md:bg-card md:p-2 md:shadow-lg"
              >
                {flatLinks(me).map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="flex min-h-11 items-center rounded-lg px-3 text-sm tracking-normal text-foreground normal-case transition-colors duration-150 hover:bg-surface motion-reduce:transition-none"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      )}
      {account}
    </span>
  )
}
