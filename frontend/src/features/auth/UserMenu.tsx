import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { flatLinks, isStaffRole, navGroupsFor, roleHome } from '@/app/navigation'
import { useAuth } from './auth-context'

const compactLink =
  'inline-flex min-h-11 items-center hover:text-primary focus-visible:text-primary'

/**
 * Góc phải header: link đăng nhập, hoặc tên người dùng + đăng xuất (UC03).
 * Mặc định liệt kê mọi link của role theo hàng ngang. `compact` dùng cho header khách: Customer
 * gom các trang của mình vào một menu, nhân viên chỉ thấy nút "Khu làm việc".
 */
export function UserMenu({ compact = false }: { compact?: boolean }) {
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
      <span className="flex flex-col gap-1 md:flex-row md:items-center md:gap-6">
        <Link to="/login" className={compactLink}>
          Đăng nhập
        </Link>
        <Link to="/register" className={compactLink}>
          Đăng ký
        </Link>
      </span>
    ) : (
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

  const account = (
    <>
      <Link
        to="/profile"
        className={`${compact ? compactLink : ''} tracking-normal text-pearl-900 normal-case hover:text-primary`}
      >
        {me.fullName}
      </Link>
      <button
        type="button"
        onClick={onLogout}
        className={`${compact ? `${compactLink} uppercase` : 'uppercase hover:text-primary'}`}
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
            className="inline-flex min-h-11 items-center hover:text-primary"
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
    <span className="flex flex-col gap-1 md:flex-row md:items-center md:gap-6">
      {isStaffRole(me.role) ? (
        <Link to={roleHome(me.role)} className={compactLink}>
          Khu làm việc
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
              className={`${compactLink} gap-2 uppercase`}
            >
              {groups[0]?.label}
              <span aria-hidden className="text-xs">
                {open ? '▲' : '▼'}
              </span>
            </button>
            {open && (
              <ul
                id="account-links"
                className="mt-1 pl-3 md:absolute md:top-full md:right-0 md:z-30 md:mt-2 md:w-64 md:rounded-lg md:border md:border-stone-300 md:bg-white md:p-2 md:pl-2 md:shadow-md"
              >
                {flatLinks(me).map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="flex min-h-11 items-center rounded px-3 tracking-normal text-pearl-900 normal-case transition-colors duration-150 hover:bg-primary-soft motion-reduce:transition-none"
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
