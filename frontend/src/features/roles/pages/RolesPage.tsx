import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { getErrorMessage } from '@/lib/api-client'
import {
  createRole,
  listPermissions,
  listRoles,
  setRolePermissions,
  updateRole,
  type CreateRoleInput,
  type RoleItem,
  type UpdateRoleInput,
} from '../api'
import { PermissionsEditor } from '../PermissionsEditor'
import { RoleForm } from '../RoleForm'

type Panel = { kind: 'create' } | { kind: 'edit' | 'permissions'; role: RoleItem } | null

/** UC44 View Role List, UC45 Assign Permissions, UC46 Create / Update Role (chỉ Manager). */
export function RolesPage() {
  const queryClient = useQueryClient()
  const [panel, setPanel] = useState<Panel>(null)
  const [notice, setNotice] = useState('')

  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles })
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: listPermissions })

  const done = (role: RoleItem) => {
    void queryClient.invalidateQueries({ queryKey: ['roles'] })
    setNotice(`Đã lưu vai trò ${role.code}`)
    setPanel(null)
  }
  const saveRole = useMutation({
    mutationFn: (input: CreateRoleInput | UpdateRoleInput) =>
      panel?.kind === 'edit'
        ? updateRole(panel.role.id, input)
        : createRole(input as CreateRoleInput),
    onSuccess: done,
  })
  const savePermissions = useMutation({
    mutationFn: (codes: string[]) =>
      setRolePermissions((panel as { role: RoleItem }).role.id, codes),
    onSuccess: done,
  })

  const open = (next: Panel) => {
    saveRole.reset()
    savePermissions.reset()
    setNotice('')
    setPanel(next)
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Quản trị</p>
          <h1 className="font-display text-4xl font-semibold text-pearl-900">Vai trò</h1>
        </div>
        <Button onClick={() => open({ kind: 'create' })}>Thêm mới</Button>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {panel?.kind === 'create' && (
        <RoleForm
          pending={saveRole.isPending}
          error={saveRole.isError ? getErrorMessage(saveRole.error) : undefined}
          onSubmit={(input) => saveRole.mutate(input)}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel?.kind === 'edit' && (
        <RoleForm
          key={panel.role.id}
          role={panel.role}
          pending={saveRole.isPending}
          error={saveRole.isError ? getErrorMessage(saveRole.error) : undefined}
          onSubmit={(input) => saveRole.mutate(input)}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel?.kind === 'permissions' && permissions.data && (
        <PermissionsEditor
          key={panel.role.id}
          role={panel.role}
          permissions={permissions.data}
          pending={savePermissions.isPending}
          error={savePermissions.isError ? getErrorMessage(savePermissions.error) : undefined}
          onSave={(codes) => savePermissions.mutate(codes)}
          onCancel={() => setPanel(null)}
        />
      )}

      {roles.isError && <Alert tone="danger">Không tải được danh sách vai trò</Alert>}
      <div className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-200 text-xs font-semibold tracking-wider text-stone-700 uppercase">
            <tr>
              <th className="h-11 px-4">Mã</th>
              <th className="px-4">Tên</th>
              <th className="px-4">Mô tả</th>
              <th className="px-4 text-right">Tài khoản</th>
              <th className="px-4">Quyền</th>
              <th className="px-4">Trạng thái</th>
              <th className="px-4">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.data?.map((role) => (
              <tr key={role.id} className="h-13 border-t border-stone-300 hover:bg-cream-50">
                <td className="px-4 font-mono text-xs">{role.code}</td>
                <td className="px-4 font-medium text-pearl-900">
                  {role.name}
                  {role.isSystem && <span className="ml-2 text-xs text-stone-500">(hệ thống)</span>}
                </td>
                <td className="px-4 text-stone-700">{role.description ?? '—'}</td>
                <td className="px-4 text-right">{role.userCount}</td>
                <td className="px-4">{role.permissions.length}</td>
                <td className="px-4">
                  {role.isActive ? (
                    <Badge tone="success">Đang dùng</Badge>
                  ) : (
                    <Badge tone="neutral">Ngừng dùng</Badge>
                  )}
                </td>
                <td className="px-4 text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Sửa ${role.code}`}
                    onClick={() => open({ kind: 'edit', role })}
                  >
                    Sửa
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Phân quyền ${role.code}`}
                    onClick={() => open({ kind: 'permissions', role })}
                  >
                    Phân quyền
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {roles.isPending && <p className="p-6 text-center text-stone-700">Đang tải…</p>}
        {roles.data?.length === 0 && (
          <p className="p-6 text-center text-stone-700">Chưa có vai trò nào</p>
        )}
      </div>
    </section>
  )
}
