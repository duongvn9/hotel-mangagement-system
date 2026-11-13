import { useId, useState, type FormEvent } from 'react'
import { Button, Input } from '@/components/atoms'
import { FormField } from '@/components/molecules'

interface ChangePasswordFormProps {
  email: string
  pending: boolean
  error?: string
  onSubmit(newPassword: string): void
  onCancel(): void
}

/** UC43: Manager đặt mật khẩu mới cho tài khoản khác (không cần mật khẩu cũ). */
export function ChangePasswordForm({
  email,
  pending,
  error,
  onSubmit,
  onCancel,
}: ChangePasswordFormProps) {
  const uid = useId()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setMismatch('Mật khẩu xác nhận không khớp')
      return
    }
    setMismatch('')
    onSubmit(password)
  }

  const message = error ?? mismatch

  return (
    <form onSubmit={handleSubmit} aria-label="Đổi mật khẩu">
      <p className="mb-4 text-sm text-muted-foreground">
        Đặt mật khẩu mới cho <span className="font-medium text-foreground">{email}</span>.
      </p>
      {message && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {message}
        </p>
      )}
      <div className="grid gap-4">
        <FormField label="Mật khẩu mới" htmlFor={`${uid}-password`} required>
          <Input
            id={`${uid}-password`}
            type="password"
            required
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <FormField label="Xác nhận mật khẩu mới" htmlFor={`${uid}-confirm`} required>
          <Input
            id={`${uid}-confirm`}
            type="password"
            required
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </Button>
      </div>
    </form>
  )
}
