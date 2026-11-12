import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { Button, Input } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { AuthLayout } from '@/components/templates'
import { env } from '@/lib/env'
import { useAuth } from '../auth-context'
import { GoogleSignInButton } from '../components/GoogleSignInButton'

const EMPTY = { fullName: '', email: '', phone: '', password: '', confirm: '' }

/** UC01 Register Account: tạo tài khoản Customer, xác minh email rồi mới đăng nhập. */
export function RegisterPage() {
  const { me, isDevMode, register, loginWithGoogle } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [doneEmail, setDoneEmail] = useState('')
  const [signedIn, setSignedIn] = useState(false)

  if (me || signedIn) return <Navigate to="/" replace />

  const set = (field: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))
  const confirmError =
    form.confirm && form.confirm !== form.password ? 'Mật khẩu nhập lại không khớp' : ''

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (confirmError) return
    setError('')
    setPending(true)
    try {
      const email = form.email.trim()
      await register({
        email,
        password: form.password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
      })
      setDoneEmail(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đăng ký được')
    } finally {
      setPending(false)
    }
  }

  async function onGoogle() {
    setError('')
    setPending(true)
    try {
      await loginWithGoogle()
      setSignedIn(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đăng nhập được')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Tạo tài khoản của bạn"
      subtitle="Quản lý đặt phòng, đặt dịch vụ phòng và gửi đánh giá."
      brand={env.appName}
    >
      {isDevMode ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-xs text-foreground">
            Cần cấu hình Firebase (VITE_FIREBASE_*) để đăng ký. Khi dev, đăng nhập bằng tài khoản
            mẫu.
          </div>
          <Button asChild variant="outline" className="w-full rounded-full">
            <Link to="/login">Đến trang đăng nhập</Link>
          </Button>
        </div>
      ) : doneEmail ? (
        <div className="space-y-4">
          <div
            role="alert"
            className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success"
          >
            Đã tạo tài khoản. Mở email {doneEmail}, bấm vào link xác minh rồi đăng nhập.
          </div>
          <Button asChild className="w-full rounded-full">
            <Link to="/login">Đến trang đăng nhập</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <FormField label="Họ và tên" htmlFor="fullName" required>
            <Input
              id="fullName"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={form.fullName}
              onChange={set('fullName')}
            />
          </FormField>

          <FormField label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
            />
          </FormField>

          <FormField label="Số điện thoại" htmlFor="phone">
            <Input
              id="phone"
              type="tel"
              pattern="0[0-9]{9}"
              title="10 chữ số, bắt đầu bằng 0"
              autoComplete="tel"
              value={form.phone}
              onChange={set('phone')}
            />
          </FormField>

          <FormField label="Mật khẩu" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
            />
          </FormField>

          <FormField
            label="Nhập lại mật khẩu"
            htmlFor="confirm"
            required
            error={confirmError || undefined}
          >
            <Input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={set('confirm')}
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
              {pending ? 'Đang đăng ký…' : 'Đăng ký'}
            </Button>
          </div>

          <GoogleSignInButton pending={pending} onClick={() => void onGoogle()} />

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Đăng nhập
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
