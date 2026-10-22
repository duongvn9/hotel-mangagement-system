import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
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
    <form
      onSubmit={handleSubmit}
      aria-label={role ? 'Sửa vai trò' : 'Tạo vai trò'}
      className="space-y-5 rounded-lg border border-stone-300 bg-white p-6"
    >
      <h2 className="font-display text-2xl font-semibold text-pearl-900">
        {role ? `Sửa vai trò ${role.code}` : 'Tạo vai trò'}
      </h2>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-5 md:grid-cols-2">
        {!role && (
          <TextField
            label="Mã vai trò"
            required
            pattern="[A-Za-z][A-Za-z0-9_]{2,31}"
            title="3-32 ký tự chữ, số, dấu gạch dưới; bắt đầu bằng chữ. Không đổi được sau khi tạo."
            placeholder="VD: HOUSEKEEPING"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}
        <TextField
          label="Tên vai trò"
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Mô tả"
          maxLength={255}
          className="md:col-span-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {role && !role.isSystem && (
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-[18px] accent-primary"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Đang dùng (bỏ chọn để ngừng dùng vai trò)
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
