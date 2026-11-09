import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button, Checkbox, StatusBadge } from '@/components/atoms'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  PageContainer,
  PageHeader,
} from '@/components/organisms'
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
import { RoleForm } from '../RoleForm'

type Panel = { kind: 'create' } | { kind: 'edit'; role: RoleItem } | null

/** UC44 View Role List, UC45 Assign Permissions (ma trận, tick là lưu ngay), UC46 Create / Update Role. */
export function RolesPage() {
  const queryClient = useQueryClient()
  const [panel, setPanel] = useState<Panel>(null)
  const [notice, setNotice] = useState('')
  const [permError, setPermError] = useState('')
  const [savingRoleId, setSavingRoleId] = useState<string>()

  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles })
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: listPermissions })

  const saveRole = useMutation({
    mutationFn: (input: CreateRoleInput | UpdateRoleInput) =>
      panel?.kind === 'edit'
        ? updateRole(panel.role.id, input)
        : createRole(input as CreateRoleInput),
    onSuccess: (role) => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      setNotice(`Đã lưu vai trò ${role.code}`)
      setPanel(null)
    },
  })

  const savePermissions = useMutation({
    mutationFn: ({ roleId, codes }: { roleId: string; codes: string[] }) =>
      setRolePermissions(roleId, codes),
    onSuccess: (role) => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      setNotice(`Đã cập nhật quyền của ${role.name}`)
    },
    onError: (error) => setPermError(getErrorMessage(error)),
  })

  const open = (next: Panel) => {
    saveRole.reset()
    setNotice('')
    setPermError('')
    setPanel(next)
  }

  // Giữ thứ tự theo GET /permissions; ô vừa bấm lấy giá trị mới, các ô khác giữ nguyên.
  const toggle = (role: RoleItem, code: string, checked: boolean) => {
    setNotice('')
    setPermError('')
    setSavingRoleId(role.id)
    const codes = (permissions.data ?? [])
      .filter((p) => (p.code === code ? checked : role.permissions.includes(p.code)))
      .map((p) => p.code)
    savePermissions.mutate({ roleId: role.id, codes })
  }

  const roleList = roles.data ?? []

  return (
    <PageContainer>
      <PageHeader
        title="Vai trò & quyền"
        subtitle="Kiểm soát những gì mỗi vai trò được phép làm."
        actions={
          <Button className="rounded-full" onClick={() => open({ kind: 'create' })}>
            <Plus className="size-4" /> Thêm vai trò
          </Button>
        }
      />

      {notice && (
        <p role="status" className="mb-4 rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
          {notice}
        </p>
      )}
      {permError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {permError}
        </p>
      )}
      {roles.isError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Không tải được danh sách vai trò
        </p>
      )}

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface/40 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="px-4 py-3 font-medium">Quyền</th>
              {roleList.map((role) => (
                <th key={role.id} className="px-4 py-3 text-center font-medium">
                  <div className="flex flex-col items-center gap-1">
                    <span className="inline-flex items-center gap-1">
                      {role.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Sửa ${role.code}`}
                        onClick={() => open({ kind: 'edit', role })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </span>
                    <span className="font-normal normal-case">{role.userCount} người dùng</span>
                    {!role.isActive && <StatusBadge status="INACTIVE" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.data?.map((permission) => (
              <tr key={permission.code} className="border-b last:border-0">
                <td className="px-4 py-3.5">
                  <div>{permission.description}</div>
                  <div className="text-xs text-muted-foreground">{permission.code}</div>
                </td>
                {roleList.map((role) => (
                  <td key={role.id} className="px-4 text-center">
                    <Checkbox
                      aria-label={`${role.code} ${permission.code}`}
                      checked={role.permissions.includes(permission.code)}
                      disabled={savePermissions.isPending && savingRoleId === role.id}
                      onCheckedChange={(value) => toggle(role, permission.code, Boolean(value))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {(roles.isPending || permissions.isPending) && (
          <p className="p-6 text-center text-muted-foreground">Đang tải…</p>
        )}
        {roles.data?.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">Chưa có vai trò nào</p>
        )}
      </div>

      <Dialog
        open={panel !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPanel(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{panel?.kind === 'edit' ? 'Sửa vai trò' : 'Thêm vai trò'}</DialogTitle>
          </DialogHeader>
          {panel !== null && (
            <RoleForm
              key={panel.kind === 'edit' ? panel.role.id : 'create'}
              role={panel.kind === 'edit' ? panel.role : undefined}
              pending={saveRole.isPending}
              error={saveRole.isError ? getErrorMessage(saveRole.error) : undefined}
              onSubmit={(input) => saveRole.mutate(input)}
              onCancel={() => setPanel(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
