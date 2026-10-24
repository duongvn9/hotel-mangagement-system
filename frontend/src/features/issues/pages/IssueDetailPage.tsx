import { Link, useParams } from 'react-router'
import { useIssue } from '../hooks'
import { IssueBadges, IssueError } from '../IssuePresentation'
import { issueDate, issueViews, handlingLabels, type IssueRole } from '../presentation'
import { IssueHandling } from '../IssueHandling'

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
          <IssueBadges issue={issue} />
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
            {issue.handlingCategory && (
              <div>
                <dt className="font-semibold">Nhóm xử lý</dt>
                <dd>{handlingLabels[issue.handlingCategory]}</dd>
              </div>
            )}
            {issue.needsStaffAction !== undefined && (
              <div>
                <dt className="font-semibold">Cần nhân viên xử lý</dt>
                <dd>{issue.needsStaffAction ? 'Có' : 'Không'}</dd>
              </div>
            )}
            {issue.reviewedAt && (
              <div>
                <dt className="font-semibold">Ngày xem xét</dt>
                <dd>{issueDate(issue.reviewedAt)}</dd>
              </div>
            )}
            {issue.concludedAt && (
              <div>
                <dt className="font-semibold">Ngày kết luận</dt>
                <dd>{issueDate(issue.concludedAt)}</dd>
              </div>
            )}
            {role !== 'CUSTOMER' && (
              <>
                {issue.reviewedBy && (
                  <div>
                    <dt className="font-semibold">Người xem xét</dt>
                    <dd>{issue.reviewedBy}</dd>
                  </div>
                )}
                {issue.assigneeId && (
                  <div>
                    <dt className="font-semibold">Nhân viên được phân công</dt>
                    <dd>{issue.assigneeId}</dd>
                  </div>
                )}
                {issue.assignmentRequestedBy && (
                  <div>
                    <dt className="font-semibold">Người yêu cầu phân công</dt>
                    <dd>{issue.assignmentRequestedBy}</dd>
                  </div>
                )}
                {issue.assignmentRequestedAt && (
                  <div>
                    <dt className="font-semibold">Ngày yêu cầu phân công</dt>
                    <dd>{issueDate(issue.assignmentRequestedAt)}</dd>
                  </div>
                )}
                {issue.assignedAt && (
                  <div>
                    <dt className="font-semibold">Ngày phân công</dt>
                    <dd>{issueDate(issue.assignedAt)}</dd>
                  </div>
                )}
                {issue.dueAt && (
                  <div>
                    <dt className="font-semibold">Thời hạn</dt>
                    <dd>{issueDate(issue.dueAt)}</dd>
                  </div>
                )}
              </>
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
          {role !== 'CUSTOMER' && issue.reviewNotes && (
            <div>
              <h3 className="font-semibold">Ghi chú xem xét</h3>
              <p className="break-words whitespace-pre-wrap">{issue.reviewNotes}</p>
            </div>
          )}
          {role === 'RECEPTIONIST' && <IssueHandling key={issue.id} issue={issue} />}
          <section
            className="space-y-3 rounded-lg bg-cream-50 p-4"
            aria-label="Công việc liên quan"
          >
            <h3 className="font-semibold">Công việc liên quan</h3>
            {role !== 'CUSTOMER' && issue.linkedTasksAvailable ? (
              issue.linkedTasks.length ? (
                <ul className="space-y-4">
                  {issue.linkedTasks.map((task) => (
                    <li key={task.id} className="space-y-2 break-words">
                      <h4 className="font-semibold">{task.title}</h4>
                      <p>Mã công việc: {task.id}</p>
                      <p>
                        Loại: {task.taskType} · Ưu tiên: {task.priority} · Trạng thái: {task.status}
                      </p>
                      <p>Nhân viên: {task.assigneeId}</p>
                      <p>Ngày phân công: {issueDate(task.assignedAt)}</p>
                      {task.dueAt && <p>Thời hạn: {issueDate(task.dueAt)}</p>}
                      {task.completedAt && <p>Ngày hoàn tất: {issueDate(task.completedAt)}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Chưa có công việc liên quan được cung cấp.</p>
              )
            ) : (
              <p className="text-sm text-stone-700">
                Chưa thể cung cấp thông tin công việc liên quan trong phạm vi truy cập này. Điều này
                không có nghĩa là sự cố chưa có công việc.
              </p>
            )}
          </section>
        </article>
      ) : null}
    </section>
  )
}
