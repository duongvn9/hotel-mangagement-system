import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useAuth } from '../auth-context'

const EMPTY = { fullName: '', email: '', phone: '', password: '', confirm: '' }

/** UC01 Register Account: tạo tài khoản Customer, xác minh email rồi mới đăng nhập. */
export function RegisterPage() {
  const { me, isDevMode, register } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [doneEmail, setDoneEmail] = useState('')

  if (me) return <Navigate to="/" replace />

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

  return (
    <section className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="font-display text-4xl font-semibold text-pearl-900">Đăng ký tài khoản</h1>

      {isDevMode ? (
        <div className="mt-6">
          <Alert tone="info">
            Cần cấu hình Firebase (VITE_FIREBASE_*) để đăng ký. Khi dev, đăng nhập bằng tài khoản
            mẫu.
          </Alert>
        </div>
      ) : doneEmail ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success">
            Đã tạo tài khoản. Mở email {doneEmail}, bấm vào link xác minh rồi đăng nhập.
          </Alert>
          <Link to="/login" className="font-medium text-primary hover:underline">
            Đến trang đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}
          <TextField
            label="Họ và tên"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            value={form.fullName}
            onChange={set('fullName')}
          />
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
          />
          <TextField
            label="Số điện thoại"
            type="tel"
            pattern="0[0-9]{9}"
            title="10 chữ số, bắt đầu bằng 0"
            autoComplete="tel"
            value={form.phone}
            onChange={set('phone')}
          />
          <TextField
            label="Mật khẩu"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
          <TextField
            label="Nhập lại mật khẩu"
            type="password"
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
            error={confirmError}
          />
          <Button type="submit" loading={pending} className="w-full">
            Đăng ký
          </Button>
          <p className="text-center text-sm text-stone-700">
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Đăng nhập
            </Link>
          </p>
        </form>
      )}
    </section>
  )
}
