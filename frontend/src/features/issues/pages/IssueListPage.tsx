import { useState } from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { Button, Input, NativeSelect } from '@/components/atoms'
import { EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { issueStatuses, issuePriorities, type IssueQuery } from '../api'
import { useIssues } from '../hooks'
import { IssueBadges, IssueError } from '../IssuePresentation'
import {
  issueDate,
  issueRoomLabel,
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
    <PageContainer className="space-y-6">
      <PageHeader
        title={view.title}
        subtitle="Hỏng hóc do khách và nhân viên báo."
        actions={
          role === 'CUSTOMER' && (
            <Button asChild className="rounded-full">
              <Link to="/customer/issues/report">
                <Plus className="size-4" />
                Báo sự cố mới
              </Link>
            </Button>
          )
        }
      />
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FormField label="Tìm theo tiêu đề" htmlFor="issue-keyword">
            <Input
              id="issue-keyword"
              value={query.keyword ?? ''}
              maxLength={200}
              onChange={(event) => update({ keyword: event.target.value })}
            />
          </FormField>
          <FormField label="Nhóm sự cố (chính xác)" htmlFor="issue-category">
            <Input
              id="issue-category"
              value={query.category ?? ''}
              maxLength={100}
              onChange={(event) => update({ category: event.target.value })}
            />
          </FormField>
          <FormField label="Trạng thái" htmlFor="issue-status">
            <NativeSelect
              id="issue-status"
              value={query.status ?? ''}
              onChange={(event) =>
                update({ status: (event.target.value || undefined) as IssueQuery['status'] })
              }
            >
              <option value="">Tất cả</option>
              {issueStatuses.map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Mức ưu tiên" htmlFor="issue-priority">
            <NativeSelect
              id="issue-priority"
              value={query.priority ?? ''}
              onChange={(event) =>
                update({ priority: (event.target.value || undefined) as IssueQuery['priority'] })
              }
            >
              <option value="">Tất cả</option>
              {issuePriorities.map((value) => (
                <option key={value} value={value}>
                  {priorityLabels[value]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Số dòng mỗi trang" htmlFor="issue-limit">
            <NativeSelect
              id="issue-limit"
              value={query.limit}
              onChange={(event) => update({ limit: Number(event.target.value) })}
            >
              {[20, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </Panel>
      {result.isPending ? (
        <p role="status">Đang tải danh sách sự cố…</p>
      ) : result.isError ? (
        <IssueError error={result.error} retry={() => void result.refetch()} />
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {result.data.total} sự cố · Trang {query.page}/{pages}
          </p>
          {result.data.items.length === 0 ? (
            <EmptyState title="Không có sự cố phù hợp." />
          ) : (
            <ul className="space-y-4">
              {result.data.items.map((issue) => (
                <li key={issue.id} className="card-soft min-w-0 space-y-3 p-5">
                  <Button
                    asChild
                    variant="link"
                    className="h-auto min-h-11 max-w-full justify-start p-0 text-left whitespace-normal"
                  >
                    <Link
                      to={`${view.path}/${encodeURIComponent(issue.id)}`}
                      className="break-words text-sm font-semibold"
                    >
                      {issue.title}
                    </Link>
                  </Button>
                  <IssueBadges issue={issue} />
                  {role === 'CUSTOMER' && (
                    <p className="break-words text-sm text-muted-foreground">
                      {issueRoomLabel(issue)}
                    </p>
                  )}
                  <p className="break-words text-sm text-muted-foreground">
                    Nhóm sự cố: {issue.category}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ngày báo: {issueDate(issue.reportedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="Phân trang sự cố" className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={query.page <= 1}
              onClick={() => setQuery((old) => ({ ...old, page: old.page - 1 }))}
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={query.page >= pages}
              onClick={() => setQuery((old) => ({ ...old, page: old.page + 1 }))}
            >
              Trang sau
            </Button>
          </nav>
        </>
      )}
    </PageContainer>
  )
}
