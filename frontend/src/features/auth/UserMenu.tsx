import { AssetImage } from '@/components/AssetImage'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { flatLinks, workspaceHome } from '@/app/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from './auth-context'

/**
 * Góc phải header: link đăng nhập, hoặc tên người dùng + đăng xuất (UC03).
 * Mặc định liệt kê mọi link của role theo hàng ngang. `compact` dùng cho header khách: người đã
 * đăng nhập chỉ thấy một nút "Vào dashboard"; tên, hồ sơ và đăng xuất nằm trong khung làm việc.
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
  const [error, setError] = useState('')

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

  if (compact) {
    return (
      <Link
        to={workspaceHome(me)}
        className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 py-2 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 md:min-h-0"
      >
        Vào dashboard
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
          'inline-flex min-h-11 items-center text-sm font-medium tracking-normal normal-case hover:text-primary',
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
          'inline-flex min-h-11 items-center text-sm font-medium uppercase hover:text-foreground',
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
