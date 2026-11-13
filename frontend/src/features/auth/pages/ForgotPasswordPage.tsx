import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Input } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { AuthLayout } from '@/components/templates'
import { env } from '@/lib/env'
import { useAuth } from '../auth-context'

/** Quên mật khẩu: Firebase gửi link đặt lại; tài khoản chỉ có Google cũng đặt được mật khẩu qua link này. */
export function ForgotPasswordPage() {
  const { isDevMode, sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    setError('')
    setPending(true)
    try {
      await sendPasswordReset(address)
      setSentTo(address)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được email')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Quên mật khẩu"
      subtitle="Nhập email đã đăng ký, chúng tôi sẽ gửi link để bạn đặt lại mật khẩu."
      brand={env.appName}
    >
      {error && (
        <Alert tone="danger" className="mb-6">
          {error}
        </Alert>
      )}

      {isDevMode ? (
        <Alert tone="info">Cần cấu hình Firebase (VITE_FIREBASE_*) để đặt lại mật khẩu.</Alert>
      ) : sentTo ? (
        <Alert tone="success">
          Nếu {sentTo} đã đăng ký, bạn sẽ nhận được email chứa link đặt lại mật khẩu trong vài phút.
          Hãy kiểm tra cả thư mục Spam.
        </Alert>
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

          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              aria-busy={pending}
              className="w-full rounded-full"
            >
              {pending ? 'Đang gửi…' : 'Gửi link đặt lại mật khẩu'}
            </Button>
          </div>
        </form>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  )
}
