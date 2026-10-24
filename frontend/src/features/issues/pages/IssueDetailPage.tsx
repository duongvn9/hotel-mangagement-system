import { Link, useParams } from 'react-router'
import { useIssue } from '../hooks'
import { IssueBadges, IssueError } from '../IssuePresentation'
import { issueDate, issueViews, type IssueRole } from '../presentation'

export function IssueDetailPage({ role }: { role: IssueRole }) {
  const { id = '' } = useParams()
  const result = useIssue(id)
  const issue = result.isSuccess ? result.data : undefined
  const view = issueViews[role]

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-12">
      <Link to={view.path} className="inline-flex min-h-11 items-center text-primary underline">
        {view.title}
      </Link>
      <h1 className="font-display text-4xl font-semibold">{view.title} — Chi tiết sự cố</h1>
      {result.isPending ? (
        <p role="status">Đang tải chi tiết sự cố…</p>
      ) : result.isError ? (
        <IssueError error={result.error} retry={() => void result.refetch()} />
      ) : issue ? (
        <article className="space-y-6 rounded-lg border border-stone-300 bg-white p-6">
          <h2 className="font-display text-3xl break-words">{issue.title}</h2>
          <IssueBadges />
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Mã sự cố</dt>
              <dd className="break-all">{issue.id}</dd>
            </div>
            <div>
              <dt className="font-semibold">Nhóm sự cố</dt>
              <dd className="break-words">{issue.category}</dd>
            </div>
            <div>
              <dt className="font-semibold">Ngày báo</dt>
              <dd>{issueDate(issue.reportedAt)}</dd>
            </div>
            {issue.closedAt && (
              <div>
                <dt className="font-semibold">Ngày đóng</dt>
                <dd>{issueDate(issue.closedAt)}</dd>
              </div>
            )}
            <div>
              <dt className="font-semibold">Mã đặt phòng tham chiếu</dt>
              <dd className="break-all">{issue.bookingId}</dd>
            </div>
            {issue.roomId && (
              <div>
                <dt className="font-semibold">Mã phòng tham chiếu</dt>
                <dd className="break-all">{issue.roomId}</dd>
              </div>
            )}
          </dl>
          <div>
            <h3 className="font-semibold">Mô tả</h3>
            <p className="mt-2 max-w-prose break-words whitespace-pre-wrap">{issue.description}</p>
          </div>
          <p className="text-sm text-stone-700">
            Chỉ hiển thị mã tham chiếu; thông tin nguồn đặt phòng và phòng chưa được cung cấp trong
            phạm vi truy cập này.
          </p>
          <section className="rounded-lg bg-cream-50 p-4" aria-label="Công việc liên quan">
            <h3 className="font-semibold">Công việc liên quan</h3>
            <p className="mt-2 text-sm text-stone-700">
              Chưa thể cung cấp thông tin công việc liên quan do quyền truy cập nguồn chưa được hỗ
              trợ. Điều này không có nghĩa là sự cố chưa có công việc.
            </p>
          </section>
        </article>
      ) : null}
    </section>
  )
}
