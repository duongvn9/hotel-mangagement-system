import { useState } from 'react'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import type { PermissionItem, RoleItem } from './api'

interface PermissionsEditorProps {
  role: RoleItem
  permissions: PermissionItem[]
  pending: boolean
  error?: string
  onSave(permissions: string[]): void
  onCancel(): void
}

/** UC45 Assign Permissions: tick các quyền của role rồi lưu cả danh sách. */
export function PermissionsEditor({
  role,
  permissions,
  pending,
  error,
  onSave,
  onCancel,
}: PermissionsEditorProps) {
  const [selected, setSelected] = useState(() => new Set(role.permissions))

  function toggle(code: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <section
      aria-label={`Phân quyền ${role.code}`}
      className="space-y-5 rounded-lg border border-stone-300 bg-white p-6"
    >
      <h2 className="font-display text-2xl font-semibold text-pearl-900">
        Phân quyền: {role.name}
      </h2>
      {error && <Alert tone="danger">{error}</Alert>}
      <ul className="grid gap-3 md:grid-cols-2">
        {permissions.map((p) => (
          <li key={p.code}>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-[18px] accent-primary"
                checked={selected.has(p.code)}
                onChange={() => toggle(p.code)}
              />
              <span>
                <span className="block font-medium text-pearl-900">{p.description}</span>
                <code className="text-xs text-stone-500">{p.code}</code>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Huỷ
        </Button>
        <Button
          loading={pending}
          onClick={() => onSave(permissions.map((p) => p.code).filter((c) => selected.has(c)))}
        >
          Lưu phân quyền
        </Button>
      </div>
    </section>
  )
}
