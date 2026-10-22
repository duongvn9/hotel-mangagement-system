import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import type { Account, CreateAccountInput, UpdateAccountInput } from './api'

interface AccountFormProps {
  /** Không truyền = tạo mới. */
  account?: Account
  roleOptions: { value: string; label: string }[]
  /** Đang sửa chính mình: không cho đổi vai trò, không tự khoá. */
  isSelf: boolean
  pending: boolean
  error?: string
  onSubmit(input: CreateAccountInput | UpdateAccountInput): void
  onCancel(): void
}

/** UC43 Create / Update Account. */
export function AccountForm({
  account,
  roleOptions,
  isSelf,
  pending,
  error,
  onSubmit,
  onCancel,
}: AccountFormProps) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: account?.fullName ?? '',
    phone: account?.phone ?? '',
    role: account?.role ?? roleOptions[0]?.value ?? '',
    isActive: account?.isActive ?? true,
  })
  const set =
    (field: 'email' | 'password' | 'fullName' | 'phone' | 'role') =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const common = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim() || undefined,
    }
    if (!account) {
      onSubmit({ ...common, email: form.email.trim(), password: form.password, role: form.role })
    } else {
      onSubmit(isSelf ? common : { ...common, role: form.role, isActive: form.isActive })
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={account ? 'Sửa tài khoản' : 'Tạo tài khoản'}
      className="space-y-5 rounded-lg border border-stone-300 bg-white p-6"
    >
      <h2 className="font-display text-2xl font-semibold text-pearl-900">
        {account ? `Sửa tài khoản ${account.email}` : 'Tạo tài khoản'}
      </h2>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-5 md:grid-cols-2">
        {!account && (
          <>
            <TextField
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={set('email')}
            />
            <TextField
              label="Mật khẩu ban đầu"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
            />
          </>
        )}
        <TextField
          label="Họ và tên"
          required
          minLength={2}
          maxLength={100}
          value={form.fullName}
          onChange={set('fullName')}
        />
        <TextField
          label="Số điện thoại"
          type="tel"
          pattern="0[0-9]{9}"
          title="10 chữ số, bắt đầu bằng 0"
          value={form.phone}
          onChange={set('phone')}
        />
        <SelectField
          label="Vai trò"
          required
          disabled={isSelf}
          options={roleOptions}
          value={form.role}
          onChange={set('role')}
        />
        {account && (
          <label className="flex items-center gap-3 self-end pb-3 text-sm">
            <input
              type="checkbox"
              className="size-[18px] accent-primary"
              disabled={isSelf}
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Đang hoạt động (bỏ chọn để khoá tài khoản)
          </label>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" loading={pending}>
          Lưu
        </Button>
      </div>
    </form>
  )
}
