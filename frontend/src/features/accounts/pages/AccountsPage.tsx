import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { ROLE_LABELS } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
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
// shortcut: chỉ có 5 role hệ thống, đổi sang GET /roles khi có màn quản lý role (UC44).
const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

/** UC42 View Account List + UC43 Create / Update Account (chỉ Manager, BR-RBAC-01). */
export function AccountsPage() {
  const { me } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState<AccountQuery>({ page: 1, limit: LIMIT })
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [notice, setNotice] = useState('')

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

  function onSearch(event: FormEvent) {
    event.preventDefault()
    filter({ search: search.trim() || undefined })
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Quản trị</p>
          <h1 className="font-display text-4xl font-semibold text-pearl-900">Tài khoản</h1>
        </div>
        <Button onClick={() => openForm('new')}>Thêm mới</Button>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {editing && (
        <AccountForm
          key={editing === 'new' ? 'new' : editing.id}
          account={editing === 'new' ? undefined : editing}
          roleOptions={ROLE_OPTIONS}
          isSelf={editing !== 'new' && editing.id === me?.id}
          pending={save.isPending}
          error={save.isError ? getErrorMessage(save.error) : undefined}
          onSubmit={(input) => save.mutate(input)}
          onCancel={() => setEditing(null)}
        />
      )}

      <form onSubmit={onSearch} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto]">
        <TextField
          label="Tìm kiếm"
          type="search"
          placeholder="Tên, email hoặc số điện thoại"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SelectField
          label="Vai trò"
          options={[{ value: '', label: 'Tất cả' }, ...ROLE_OPTIONS]}
          value={query.role ?? ''}
          onChange={(e) => filter({ role: e.target.value || undefined })}
        />
        <SelectField
          label="Trạng thái"
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'true', label: 'Đang hoạt động' },
            { value: 'false', label: 'Đã khoá' },
          ]}
          value={query.isActive ?? ''}
          onChange={(e) =>
            filter({ isActive: (e.target.value || undefined) as AccountQuery['isActive'] })
          }
        />
        <Button type="submit" variant="secondary" className="self-end">
          Tìm
        </Button>
      </form>

      {isError && <Alert tone="danger">Không tải được danh sách tài khoản</Alert>}
      <div className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-200 text-xs font-semibold tracking-wider text-stone-700 uppercase">
            <tr>
              <th className="h-11 px-4">Họ tên</th>
              <th className="px-4">Email</th>
              <th className="px-4">Số điện thoại</th>
              <th className="px-4">Vai trò</th>
              <th className="px-4">Trạng thái</th>
              <th className="px-4">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((account) => (
              <tr key={account.id} className="h-13 border-t border-stone-300 hover:bg-cream-50">
                <td className="px-4 font-medium text-pearl-900">{account.fullName}</td>
                <td className="px-4">{account.email}</td>
                <td className="px-4">{account.phone ?? '—'}</td>
                <td className="px-4">{ROLE_LABELS[account.role] ?? account.role}</td>
                <td className="px-4">
                  {account.isActive ? (
                    <Badge tone="success">Hoạt động</Badge>
                  ) : (
                    <Badge tone="danger">Đã khoá</Badge>
                  )}
                </td>
                <td className="px-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Sửa ${account.email}`}
                    onClick={() => openForm(account)}
                  >
                    Sửa
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isPending && <p className="p-6 text-center text-stone-700">Đang tải…</p>}
        {data && data.items.length === 0 && (
          <p className="p-6 text-center text-stone-700">Không có tài khoản phù hợp</p>
        )}
      </div>

      {data && data.total > data.limit && (
        <nav aria-label="Phân trang" className="flex items-center justify-end gap-3 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={query.page <= 1}
            onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}
          >
            Trước
          </Button>
          <span>
            Trang {query.page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={query.page >= totalPages}
            onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
          >
            Sau
          </Button>
        </nav>
      )}
    </section>
  )
}
