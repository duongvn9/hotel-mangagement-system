import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Button, Input, NativeSelect, Skeleton } from '@/components/atoms'
import { Alert, EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel, Pager } from '@/components/organisms'
import {
  reviewLabels,
  reviewStatuses,
  executionLabels,
  executionStatuses,
  type OrderQuery,
} from '../api'
import { useServiceReport, useServiceReports } from '../intake'
import { OrderReceipt } from '../presentation'
import { IntakeDetails } from '../IntakeDetails'

export function ServiceReportsPage() {
  const [query, setQuery] = useState<OrderQuery>({ page: 1, limit: 20 })
  const [keyword, setKeyword] = useState('')
  const reports = useServiceReports(query)
  function search(event: FormEvent) {
    event.preventDefault()
    setQuery({ ...query, keyword: keyword.trim(), page: 1 })
  }
  return (
    <PageContainer>
      <PageHeader
        title="Yêu cầu tôi ghi nhận"
        subtitle="Chỉ hiển thị yêu cầu do bạn báo cáo; không phải danh sách quản lý."
        actions={
          <>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/staff/service-history">Lịch sử thực hiện dịch vụ</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link to="/staff/service-history/intake">Ghi nhận yêu cầu</Link>
            </Button>
          </>
        }
      />
      <Panel>
        <form onSubmit={search} className="mb-6 grid gap-4 sm:grid-cols-2">
          <FormField label="Từ khóa dịch vụ" htmlFor="reports-keyword">
            <Input
              id="reports-keyword"
              maxLength={100}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </FormField>
          <FormField label="Trạng thái duyệt" htmlFor="reports-review">
            <NativeSelect
              id="reports-review"
              value={query.reviewStatus ?? ''}
              onChange={(event) =>
                setQuery({
                  ...query,
                  page: 1,
                  reviewStatus: event.target.value as OrderQuery['reviewStatus'],
                })
              }
            >
              <option value="">Tất cả</option>
              {reviewStatuses.map((status) => (
                <option key={status} value={status}>
                  {reviewLabels[status]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Trạng thái thực hiện" htmlFor="reports-execution">
            <NativeSelect
              id="reports-execution"
              value={query.executionStatus ?? ''}
              onChange={(event) =>
                setQuery({
                  ...query,
                  page: 1,
                  executionStatus: event.target.value as OrderQuery['executionStatus'],
                })
              }
            >
              <option value="">Tất cả</option>
              {executionStatuses.map((status) => (
                <option key={status} value={status}>
                  {executionLabels[status]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <Button type="submit" disabled={reports.isFetching} className="w-fit rounded-full">
            Tìm kiếm
          </Button>
        </form>
        {reports.isPending && (
          <div role="status">
            <Skeleton className="h-32 w-full" />
            Đang tải yêu cầu…
          </div>
        )}
        {reports.isError && (
          <Alert tone="danger">
            Không thể tải yêu cầu của bạn.{' '}
            <Button onClick={() => void reports.refetch()}>Thử lại</Button>
          </Alert>
        )}
        {reports.data && (
          <>
            {reports.data.items.length === 0 ? (
              <EmptyState title="Chưa có yêu cầu phù hợp." />
            ) : (
              <ul className="divide-y divide-border">
                {reports.data.items.map((order) => (
                  <li key={order.id} className="space-y-2 py-3 text-sm break-words">
                    <Button
                      asChild
                      variant="link"
                      className="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                    >
                      <Link to={`/staff/service-history/reports/${encodeURIComponent(order.id)}`}>
                        {order.service.name}
                      </Link>
                    </Button>
                    <p>
                      {order.booking?.code} · {order.requesterName || order.customer.fullName}
                    </p>
                    <p>
                      {reviewLabels[order.reviewStatus]} · {executionLabels[order.executionStatus]}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Pager
              page={query.page}
              totalPages={Math.max(1, Math.ceil(reports.data.total / query.limit))}
              disabled={reports.isFetching}
              onPrev={() => setQuery({ ...query, page: query.page - 1 })}
              onNext={() => setQuery({ ...query, page: query.page + 1 })}
            />
          </>
        )}
      </Panel>
    </PageContainer>
  )
}
export function ServiceReportDetailPage() {
  const { id = '' } = useParams()
  const report = useServiceReport(id)
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Chi tiết yêu cầu tôi ghi nhận"
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/staff/service-history/reports">Yêu cầu tôi ghi nhận</Link>
          </Button>
        }
      />
      {report.isPending && (
        <div role="status">
          <Skeleton className="h-32 w-full" />
          Đang tải yêu cầu…
        </div>
      )}
      {report.isError && (
        <Alert tone="danger">
          Không tìm thấy yêu cầu, không thuộc tài khoản hoặc không thể tải dữ liệu.{' '}
          <Button onClick={() => void report.refetch()}>Thử lại</Button>
        </Alert>
      )}
      {report.data && (
        <>
          <OrderReceipt order={report.data} presentation="workspace" />
          <IntakeDetails order={report.data} />
        </>
      )}
    </PageContainer>
  )
}
