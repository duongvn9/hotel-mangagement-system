import { useId, useState, type FormEvent } from 'react'
import { Button, Input, Switch } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import type { CreateRoleInput, RoleItem, UpdateRoleInput } from './api'

interface RoleFormProps {
  /** Không truyền = tạo mới. */
  role?: RoleItem
  pending: boolean
  error?: string
  onSubmit(input: CreateRoleInput | UpdateRoleInput): void
  onCancel(): void
}

/** UC46 Create / Update Role. Mã role chỉ nhập khi tạo (BR-RBAC-05). */
export function RoleForm({ role, pending, error, onSubmit, onCancel }: RoleFormProps) {
  const uid = useId()
  const [code, setCode] = useState('')
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [isActive, setIsActive] = useState(role?.isActive ?? true)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const common = { name: name.trim(), description: description.trim() || undefined }
    onSubmit(
      role
        ? { ...common, ...(role.isSystem ? {} : { isActive }) }
        : { ...common, code: code.trim().toUpperCase() },
    )
  }

  return (
    <form onSubmit={handleSubmit} aria-label={role ? 'Sửa vai trò' : 'Tạo vai trò'}>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {!role && (
          <FormField
            label="Mã vai trò"
            htmlFor={`${uid}-code`}
            required
            hint="3-32 ký tự chữ, số, gạch dưới; không đổi được sau khi tạo."
          >
            <Input
              id={`${uid}-code`}
              required
              pattern="[A-Za-z][A-Za-z0-9_]{2,31}"
              title="3-32 ký tự chữ, số, dấu gạch dưới; bắt đầu bằng chữ. Không đổi được sau khi tạo."
              placeholder="VD: HOUSEKEEPING"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </FormField>
        )}
        <FormField label="Tên vai trò" htmlFor={`${uid}-name`} required>
          <Input
            id={`${uid}-name`}
            required
            minLength={2}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Mô tả" htmlFor={`${uid}-desc`}>
            <Input
              id={`${uid}-desc`}
              maxLength={255}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </div>
        {role && !role.isSystem && (
          <FormField label="Đang dùng" htmlFor={`${uid}-active`}>
            <Switch
              id={`${uid}-active`}
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked)}
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
