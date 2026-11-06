import { useId, useState, type FormEvent } from 'react'
import { Button, Input, NativeSelect, Switch } from '@/components/atoms'
import { FormField } from '@/components/molecules'
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
  const uid = useId()
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
    // Khi sửa, gửi chuỗi rỗng để xoá số điện thoại; khi tạo thì bỏ trống luôn.
    const common = { fullName: form.fullName.trim(), phone: form.phone.trim() }
    if (!account) {
      onSubmit({
        ...common,
        phone: common.phone || undefined,
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
    } else {
      onSubmit(isSelf ? common : { ...common, role: form.role, isActive: form.isActive })
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={account ? 'Sửa tài khoản' : 'Tạo tài khoản'}>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {!account && (
          <>
            <FormField label="Email" htmlFor={`${uid}-email`} required>
              <Input
                id={`${uid}-email`}
                type="email"
                required
                value={form.email}
                onChange={set('email')}
              />
            </FormField>
            <FormField label="Mật khẩu ban đầu" htmlFor={`${uid}-password`} required>
              <Input
                id={`${uid}-password`}
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
              />
            </FormField>
          </>
        )}
        <FormField label="Họ và tên" htmlFor={`${uid}-fullName`} required>
          <Input
            id={`${uid}-fullName`}
            required
            minLength={2}
            maxLength={100}
            value={form.fullName}
            onChange={set('fullName')}
          />
        </FormField>
        <FormField label="Số điện thoại" htmlFor={`${uid}-phone`}>
          <Input
            id={`${uid}-phone`}
            type="tel"
            pattern="0[0-9]{9}"
            title="10 chữ số, bắt đầu bằng 0"
            value={form.phone}
            onChange={set('phone')}
          />
        </FormField>
        <FormField label="Vai trò" htmlFor={`${uid}-role`} required>
          <NativeSelect
            id={`${uid}-role`}
            required
            disabled={isSelf}
            value={form.role}
            onChange={set('role')}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        {account && (
          <FormField label="Đang hoạt động" htmlFor={`${uid}-active`}>
            <Switch
              id={`${uid}-active`}
              disabled={isSelf}
              checked={form.isActive}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
            />
          </FormField>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </div>
    </form>
  )
}
