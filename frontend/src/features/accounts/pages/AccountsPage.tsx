import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { AssetImage } from '@/components/AssetImage'
import { Button, NativeSelect, StatusBadge } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import {
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  PageContainer,
  PageHeader,
  type Column,
} from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { listRoles } from '@/features/roles/api'
import { getErrorMessage } from '@/lib/api-client'
import { AccountForm } from '../AccountForm'
import {
  createAccount,
  listAccounts,
  updateAccount,
  type Account,
  type AccountQuery,
  type CreateAccountInput,
  type UpdateAccountInput,
} from '../api'

const LIMIT = 20

/** UC42 View Account List + UC43 Create / Update Account (chỉ Manager, BR-RBAC-01). */
export function AccountsPage() {
  const { me } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState<AccountQuery>({ page: 1, limit: LIMIT })
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [notice, setNotice] = useState('')

  const roles = useQuery({ queryKey: ['roles'], queryFn: listRoles })
  // Chỉ gán role đang dùng (BR-RBAC-05); bảng vẫn hiện tên role đã ngừng dùng.
  const roleOptions = (roles.data ?? [])
    .filter((r) => r.isActive)
    .map((r) => ({ value: r.code, label: r.name }))
  const roleName = (code: string) => roles.data?.find((r) => r.code === code)?.name ?? code

  const { data, isPending, isError } = useQuery({
    queryKey: ['accounts', query],
    queryFn: () => listAccounts(query),
    placeholderData: keepPreviousData,
  })

  const save = useMutation({
    mutationFn: (input: CreateAccountInput | UpdateAccountInput) =>
      editing === 'new' || !editing
        ? createAccount(input as CreateAccountInput)
        : updateAccount(editing.id, input),
    onSuccess: (account) => {
      void queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setNotice(`Đã lưu tài khoản ${account.email}`)
      setEditing(null)
    },
  })

  const filter = (patch: Partial<AccountQuery>) => setQuery((q) => ({ ...q, ...patch, page: 1 }))
  const openForm = (target: Account | 'new') => {
    save.reset()
    setNotice('')
    setEditing(target)
  }
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  const columns: Column<Account>[] = [
    {
      key: 'fullName',
      header: 'Họ tên',
      render: (account) => (
        <span className="inline-flex items-center gap-2 font-medium">
          <AssetImage decorative path={account.avatarUrl} name={account.fullName} />
          {account.fullName}
        </span>
      ),
    },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Số điện thoại', render: (account) => account.phone ?? '—' },
    { key: 'role', header: 'Vai trò', render: (account) => roleName(account.role) },
    {
      key: 'isActive',
      header: 'Trạng thái',
      render: (account) => <StatusBadge status={account.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: '_actions',
      header: '',
      className: 'w-24 text-right',
      render: (account) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Sửa ${account.email}`}
            onClick={() => openForm(account)}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Tài khoản"
        subtitle="Tạo tài khoản nhân viên, phân vai trò và khoá quyền truy cập."
        actions={
          <Button className="rounded-full" onClick={() => openForm('new')}>
            <Plus className="size-4" /> Thêm tài khoản
          </Button>
        }
      />

      {notice && (
        <p role="status" className="mb-4 rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
          {notice}
        </p>
      )}
      {isError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Không tải được danh sách tài khoản
        </p>
      )}

      <DataTable
        rows={data?.items ?? []}
        columns={columns}
        loading={isPending}
        onRowClick={(account) => openForm(account)}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => filter({ search: search.trim() || undefined })}
        searchPlaceholder="Tên, email hoặc số điện thoại"
        searchAriaLabel="Tìm kiếm"
        toolbarStart={
          <>
            <div className="md:w-44">
              <NativeSelect
                aria-label="Vai trò"
                className="h-9 rounded-full"
                value={query.role ?? ''}
                onChange={(event) => filter({ role: event.target.value || undefined })}
              >
                <option value="">Tất cả</option>
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="md:w-44">
              <NativeSelect
                aria-label="Trạng thái"
                className="h-9 rounded-full"
                value={query.isActive ?? ''}
                onChange={(event) =>
                  filter({
                    isActive: (event.target.value || undefined) as AccountQuery['isActive'],
                  })
                }
              >
                <option value="">Tất cả</option>
                <option value="true">Đang hoạt động</option>
                <option value="false">Đã khoá</option>
              </NativeSelect>
            </div>
          </>
        }
        page={query.page}
        totalPages={totalPages}
        onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
        empty={<EmptyState title="Không có tài khoản phù hợp" />}
      />

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Thêm tài khoản' : 'Sửa tài khoản'}</DialogTitle>
          </DialogHeader>
          {editing !== null && (
            <AccountForm
              key={editing === 'new' ? 'new' : editing.id}
              account={editing === 'new' ? undefined : editing}
              roleOptions={roleOptions}
              isSelf={editing !== 'new' && editing.id === me?.id}
              pending={save.isPending}
              error={save.isError ? getErrorMessage(save.error) : undefined}
              onSubmit={(input) => save.mutate(input)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
