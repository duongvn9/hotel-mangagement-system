import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { roleHome } from '@/app/navigation'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { getDevAccounts, type DevAccount } from '../api'
import { useAuth } from '../auth-context'

/** UC02 Login. */
export function LoginPage() {
  const { me, isDevMode, login, loginAsDev } = useAuth()
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
    <section className="mx-auto grid max-w-container gap-12 px-4 py-16 md:grid-cols-2">
      <div className="hidden rounded-lg bg-pearl-900 p-12 text-cream-100 md:block">
        <p className="text-xs font-semibold tracking-widest text-gold-500 uppercase">
          Chào mừng trở lại
        </p>
        <h1 className="mt-4 font-display text-5xl font-semibold">Đăng nhập</h1>
        <p className="mt-6 opacity-80">
          Đăng nhập để đặt phòng, theo dõi đặt phòng và dùng các chức năng theo vai trò của bạn.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md">
        <h2 className="font-display text-4xl font-semibold text-pearl-900 md:hidden">Đăng nhập</h2>
        {error && (
          <div className="mt-6">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        <p className="mt-4 text-sm text-stone-700">
          Khách vãng lai?{' '}
          <Link to="/booking/lookup" className="font-medium text-primary hover:underline">
            Tra cứu đơn bằng mã
          </Link>
        </p>
        {isDevMode ? (
          <DevLogin pending={pending} onPick={(account) => run(() => loginAsDev(account))} />
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label="Mật khẩu"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" loading={pending} className="w-full">
              Đăng nhập
            </Button>
            <p className="text-center text-sm text-stone-700">
              Chưa có tài khoản?{' '}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Đăng ký
              </Link>
            </p>
          </form>
        )}
      </div>
    </section>
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
    <div className="mt-6 space-y-4">
      <Alert tone="info">
        Chưa cấu hình Firebase (VITE_FIREBASE_*): chọn một tài khoản mẫu để đăng nhập. Chạy{' '}
        <code>npm run seed</code> ở backend nếu danh sách trống.
      </Alert>
      {isPending && <p className="text-sm text-stone-700">Đang tải tài khoản…</p>}
      {isError && <Alert tone="danger">Không tải được danh sách tài khoản</Alert>}
      <ul className="divide-y divide-stone-300 rounded-lg border border-stone-300 bg-white">
        {data?.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => onPick(account)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-cream-50 disabled:opacity-40"
            >
              <span>
                <span className="block font-medium text-pearl-900">{account.fullName}</span>
                <span className="text-sm text-stone-700">{account.email}</span>
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
