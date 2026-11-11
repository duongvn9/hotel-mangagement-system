import { Link, useParams } from 'react-router'
import { Button } from '@/components/atoms'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { useIssue } from '../hooks'
import { IssueBadges, IssueError } from '../IssuePresentation'
import {
  bookingCode,
  personName,
  taskStatusLabel,
  taskTypeLabel,
  taskPriorityLabel,
  issueDate,
  issueRoomLabel,
  issueViews,
  handlingLabels,
  customerHistoryLabels,
  type IssueRole,
} from '../presentation'
import { IssueHandling } from '../IssueHandling'
import { IssueClosure } from '../IssueClosure'
import { IssueTaskRecovery } from '../IssueTaskRecovery'

export function IssueDetailPage({ role }: { role: IssueRole }) {
  const { id = '' } = useParams()
  const result = useIssue(id)
  const issue = result.isSuccess ? result.data : undefined
  const view = issueViews[role]
  const customerHistory =
    role === 'CUSTOMER' && Array.isArray(issue?.customerHistory)
      ? issue.customerHistory
          .filter(
            (event) =>
              event &&
              Object.hasOwn(customerHistoryLabels, event.type) &&
              typeof event.at === 'string' &&
              event.at.trim() !== '' &&
              Number.isFinite(new Date(event.at).getTime()),
          )
          .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      : []

  return (
    <PageContainer className="space-y-6">
      <Button asChild variant="link" className="min-h-11 p-0">
        <Link to={view.path}>{view.title}</Link>
      </Button>
      <PageHeader title={`${view.title} — Chi tiết sự cố`} />
      {result.isPending ? (
        <p role="status">Đang tải chi tiết sự cố…</p>
      ) : result.isError ? (
        <IssueError error={result.error} retry={() => void result.refetch()} />
      ) : issue ? (
        <Panel title={<span className="break-words">{issue.title}</span>}>
          <article className="min-w-0 space-y-6 text-sm [&_dd]:break-words [&_dt]:text-muted-foreground">
            <IssueBadges issue={issue} />
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
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
              {issue.closedAt && (
                <div>
                  <dt className="font-semibold">Ngày đóng</dt>
                  <dd>{issueDate(issue.closedAt)}</dd>
                </div>
              )}
              {role !== 'CUSTOMER' && (
                <>
                  <div>
                    <dt className="font-semibold">Người báo</dt>
                    <dd>{personName(issue.reporterName)}</dd>
                  </div>
                  {issue.closedBy && (
                    <div>
                      <dt className="font-semibold">Người đóng</dt>
                      <dd className="break-all">{personName(issue.closedByName)}</dd>
                    </div>
                  )}
                  {issue.reviewedBy && (
                    <div>
                      <dt className="font-semibold">Người xem xét</dt>
                      <dd>{personName(issue.reviewedByName)}</dd>
                    </div>
                  )}
                  {issue.assigneeId && (
                    <div>
                      <dt className="font-semibold">Nhân viên được phân công</dt>
                      <dd>{personName(issue.assigneeName)}</dd>
                    </div>
                  )}
                  {issue.assignmentRequestedBy && (
                    <div>
                      <dt className="font-semibold">Người yêu cầu phân công</dt>
                      <dd>{personName(issue.assignmentRequestedByName)}</dd>
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
                <dt className="font-semibold">Mã đặt phòng</dt>
                <dd className="break-words">{bookingCode(issue.bookingCode)}</dd>
              </div>
              <div>
                <dt className="font-semibold">Phòng</dt>
                <dd>{issueRoomLabel(issue)}</dd>
              </div>
            </dl>
            <div>
              <h3 className="font-semibold">Mô tả</h3>
              <p className="mt-2 max-w-prose break-words whitespace-pre-wrap">
                {issue.description}
              </p>
            </div>
            {role === 'CUSTOMER' && (
              <section className="space-y-3" aria-labelledby="customer-history-heading">
                <h3 id="customer-history-heading" className="text-sm font-semibold">
                  Lịch sử xử lý
                </h3>
                {customerHistory.length ? (
                  <ol aria-labelledby="customer-history-heading" className="space-y-3 text-sm">
                    {customerHistory.map((event, index) => (
                      <li key={`${event.type}-${event.at}-${index}`} className="break-words">
                        <p className="font-medium">{customerHistoryLabels[event.type]}</p>
                        <time dateTime={event.at} className="text-muted-foreground">
                          {issueDate(event.at)}
                        </time>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa có lịch sử xử lý được cung cấp.
                  </p>
                )}
              </section>
            )}
            {role !== 'CUSTOMER' && issue.reviewNotes && (
              <div>
                <h3 className="font-semibold">Ghi chú xem xét</h3>
                <p className="break-words whitespace-pre-wrap">{issue.reviewNotes}</p>
              </div>
            )}
            {role !== 'CUSTOMER' && issue.closureConclusion && (
              <div>
                <h3 className="font-semibold">Kết luận đóng sự cố</h3>
                <p className="break-words whitespace-pre-wrap">{issue.closureConclusion}</p>
              </div>
            )}
            {role === 'RECEPTIONIST' && <IssueHandling key={issue.id} issue={issue} />}
            {(role === 'RECEPTIONIST' || role === 'MANAGER') && (
              <IssueClosure key={`close-${issue.id}`} issue={issue} />
            )}
            {(role === 'RECEPTIONIST' || role === 'MANAGER') && (
              <IssueTaskRecovery key={`recovery-${issue.id}`} issue={issue} />
            )}
            <section
              className="space-y-3 rounded-xl bg-surface p-4"
              aria-label="Công việc liên quan"
            >
              <h3 className="font-semibold">Công việc liên quan</h3>
              {role !== 'CUSTOMER' && issue.linkedTasksAvailable ? (
                issue.linkedTasks.length ? (
                  <ul className="space-y-4">
                    {issue.linkedTasks.map((task) => (
                      <li key={task.id} className="space-y-2 break-words">
                        <h4 className="font-semibold">{task.title}</h4>
                        <p>
                          Loại: {taskTypeLabel(task.taskType)} · Ưu tiên:{' '}
                          {taskPriorityLabel(task.priority)} · Trạng thái:{' '}
                          {taskStatusLabel(task.status)}
                        </p>
                        <p>Nhân viên: {personName(task.assigneeName)}</p>
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
                <p className="text-sm text-muted-foreground">
                  Chưa thể cung cấp thông tin công việc liên quan trong phạm vi truy cập này. Điều
                  này không có nghĩa là sự cố chưa có công việc.
                </p>
              )}
            </section>
          </article>
        </Panel>
      ) : null}
    </PageContainer>
  )
}
