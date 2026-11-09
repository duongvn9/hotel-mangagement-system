import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { roleHome } from '@/app/navigation'
import { AssetImage } from '@/components/AssetImage'
import { Button, Input } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { AuthLayout } from '@/components/templates'
import { getErrorMessage } from '@/lib/api-client'
import { env } from '@/lib/env'
import { getDevAccounts, type DevAccount } from '../api'
import { useAuth } from '../auth-context'
import { GoogleSignInButton } from '../components/GoogleSignInButton'

/** UC02 Login. */
export function LoginPage() {
  const { me, isDevMode, login, loginAsDev, loginWithGoogle } = useAuth()
  const from = (useLocation().state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  // Về trang đang xem dở; nếu không có thì nhân viên vào trang làm việc của vai trò, khách về trang chủ.
  const destination = from && from !== '/' ? from : me ? roleHome(me.role) : '/'

  if (me || signedIn) return <Navigate to={destination} replace />

  async function run(action: () => Promise<void>) {
    setError('')
    setPending(true)
    try {
      await action()
      setSignedIn(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : getErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void run(() => login(email.trim(), password))
  }

  return (
    <AuthLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập vào tài khoản của bạn."
      brand={env.appName}
    >
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {isDevMode ? (
        <DevLogin pending={pending} onPick={(account) => run(() => loginAsDev(account))} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField label="Mật khẩu" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              aria-busy={pending}
              className="w-full rounded-full"
            >
              {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </div>
        </form>
      )}

      {!isDevMode && (
        <div className="mt-4">
          <GoogleSignInButton pending={pending} onClick={() => void run(loginWithGoogle)} />
        </div>
      )}

      <div className="mt-6 space-y-2 text-sm text-muted-foreground">
        <p>
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Đăng ký
          </Link>
        </p>
        <p>
          Khách vãng lai?{' '}
          <Link to="/booking/lookup" className="font-medium text-primary hover:underline">
            Tra cứu đơn bằng mã
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

function DevLogin({
  pending,
  onPick,
}: {
  pending: boolean
  onPick: (account: DevAccount) => void
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['auth', 'dev-accounts'],
    queryFn: getDevAccounts,
  })

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-xs text-foreground">
        Chưa cấu hình Firebase (VITE_FIREBASE_*): chọn một tài khoản mẫu để đăng nhập. Chạy{' '}
        <code className="font-mono text-primary">npm run seed</code> ở backend nếu danh sách trống.
      </div>
      {isPending && <p className="text-sm text-muted-foreground">Đang tải tài khoản…</p>}
      {isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          Không tải được danh sách tài khoản
        </div>
      )}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {data?.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => onPick(account)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-surface disabled:opacity-40"
            >
              <span>
                <span className="block font-medium text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <AssetImage decorative path={account.avatarUrl} name={account.fullName} />
                    {account.fullName}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{account.email}</span>
              </span>
              <span className="text-xs font-semibold tracking-wider text-primary">
                {account.role}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
