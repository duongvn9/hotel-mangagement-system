import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
import { issueStatuses, issuePriorities, type IssueQuery } from '../api'
import { useIssues } from '../hooks'
import { IssueBadges, IssueError } from '../IssuePresentation'
import {
  issueDate,
  issueViews,
  statusLabels,
  priorityLabels,
  type IssueRole,
} from '../presentation'

export function IssueListPage({ role }: { role: IssueRole }) {
  const view = issueViews[role]
  const [query, setQuery] = useState<IssueQuery>({ page: 1, limit: 20 })
  const result = useIssues(query)
  const update = (patch: Partial<IssueQuery>) => setQuery((old) => ({ ...old, ...patch, page: 1 }))
  const pages = Math.min(10000, Math.max(1, Math.ceil((result.data?.total ?? 0) / query.limit)))

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold">{view.title}</h1>
        {role === 'CUSTOMER' && (
          <Link
            to="/customer/issues/report"
            className="inline-flex min-h-11 items-center text-primary underline"
          >
            Báo sự cố mới
          </Link>
        )}
      </div>
      <div className="grid gap-4 rounded-lg border border-stone-300 bg-white p-6 sm:grid-cols-2 lg:grid-cols-5">
        <TextField
          label="Tìm theo tiêu đề"
          value={query.keyword ?? ''}
          maxLength={200}
          onChange={(event) => update({ keyword: event.target.value })}
        />
        <TextField
          label="Nhóm sự cố (chính xác)"
          value={query.category ?? ''}
          maxLength={100}
          onChange={(event) => update({ category: event.target.value })}
        />
        <SelectField
          label="Trạng thái"
          value={query.status ?? ''}
          options={[
            { value: '', label: 'Tất cả' },
            ...issueStatuses.map((value) => ({ value, label: statusLabels[value] })),
          ]}
          onChange={(event) =>
            update({
              status: (event.target.value || undefined) as IssueQuery['status'],
            })
          }
        />
        <SelectField
          label="Mức ưu tiên"
          value={query.priority ?? ''}
          options={[
            { value: '', label: 'Tất cả' },
            ...issuePriorities.map((value) => ({ value, label: priorityLabels[value] })),
          ]}
          onChange={(event) =>
            update({ priority: (event.target.value || undefined) as IssueQuery['priority'] })
          }
        />
        <SelectField
          label="Số dòng mỗi trang"
          value={query.limit}
          options={[20, 50, 100].map((value) => ({ value: String(value), label: String(value) }))}
          onChange={(event) => update({ limit: Number(event.target.value) })}
        />
      </div>
      {result.isPending ? (
        <p role="status">Đang tải danh sách sự cố…</p>
      ) : result.isError ? (
        <IssueError error={result.error} retry={() => void result.refetch()} />
      ) : (
        <>
          <p role="status" className="text-sm text-stone-700">
            {result.data.total} sự cố · Trang {query.page}/{pages}
          </p>
          {result.data.items.length === 0 ? (
            <p className="rounded-lg border border-stone-300 p-6">Không có sự cố phù hợp.</p>
          ) : (
            <ul className="space-y-4">
              {result.data.items.map((issue) => (
                <li
                  key={issue.id}
                  className="space-y-3 rounded-lg border border-stone-300 bg-white p-6"
                >
                  <Link
                    to={`${view.path}/${encodeURIComponent(issue.id)}`}
                    className="block min-h-11 break-words text-lg font-semibold text-primary underline"
                  >
                    {issue.title}
                  </Link>
                  <IssueBadges issue={issue} />
                  <p className="break-words text-sm text-stone-700">Nhóm sự cố: {issue.category}</p>
                  <p className="text-sm text-stone-700">Ngày báo: {issueDate(issue.reportedAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="Phân trang sự cố" className="flex flex-wrap gap-4">
            <Button
              variant="secondary"
              disabled={query.page <= 1}
              onClick={() => setQuery((old) => ({ ...old, page: old.page - 1 }))}
            >
              Trang trước
            </Button>
            <Button
              variant="secondary"
              disabled={query.page >= pages}
              onClick={() => setQuery((old) => ({ ...old, page: old.page + 1 }))}
            >
              Trang sau
            </Button>
          </nav>
        </>
      )}
    </section>
  )
}
