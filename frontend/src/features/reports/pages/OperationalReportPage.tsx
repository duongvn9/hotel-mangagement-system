import { useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useAuth } from '@/features/auth/auth-context'
import { Button, NativeSelect } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { DataTable, PageContainer, PageHeader, Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import {
  getOperationalReport,
  type OperationalQuery,
  type OperationalReport,
} from '../operational-api'
import { ReportPeriodFields } from '../components/ReportPeriodFields'
import { ReportBarChart } from '../components/ReportBarChart'
import {
  defaultRevenuePeriod,
  displayReportDay,
  parseReportDay,
  reportInputError,
  revenueTime,
  revenueLabel,
  revenueBucketLabel,
} from '../presentation'
import {
  ROOM_LABELS,
  TASK_LABELS,
  ISSUE_LABELS,
  REVIEW_LABELS,
  EXECUTION_LABELS,
  SOURCE_LABELS,
  METRICS,
  operationalPercent,
} from '../operational-presentation'

export function OperationalReportPage() {
  const [params] = useSearchParams()
  return <OperationalContent key={params.toString()} />
}
function OperationalContent() {
  const [params, setParams] = useSearchParams()
  const { me } = useAuth()
  const [defaults] = useState(defaultRevenuePeriod)
  const query: OperationalQuery = {
    from: params.get('from') ?? defaults.from,
    to: params.get('to') ?? defaults.to,
    granularity: (params.get('granularity') ?? 'day') as OperationalQuery['granularity'],
  }
  const [from, setFrom] = useState(displayReportDay(query.from)),
    [to, setTo] = useState(displayReportDay(query.to)),
    [granularity, setGranularity] = useState(query.granularity),
    [submitted, setSubmitted] = useState(false)
  const appliedError = reportInputError(displayReportDay(query.from), displayReportDay(query.to))
  const report = useQuery({
    queryKey: ['reports-operational', me?.id, query],
    queryFn: () => getOperationalReport(query),
    enabled: !appliedError,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
  const serverError =
    isAxiosError(report.error) && report.error.response?.status === 400
      ? getErrorMessage(report.error)
      : ''
  const error = (submitted ? reportInputError(from, to) : '') || serverError
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (reportInputError(from, to)) {
      event.currentTarget.querySelector('input')?.focus()
      return
    }
    const next = { from: parseReportDay(from)!, to: parseReportDay(to)!, granularity }
    if (JSON.stringify(next) === JSON.stringify(query)) void report.refetch()
    else setParams(next)
  }
  return (
    <PageContainer>
      <PageHeader
        title="Báo cáo vận hành"
        subtitle="Thống kê từ bản ghi vận hành thực tế, theo ngày Việt Nam."
      />
      <div className="space-y-6">
        <Panel>
          <form
            onSubmit={submit}
            noValidate
            aria-label="Bộ lọc báo cáo vận hành"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <ReportPeriodFields
              from={from}
              to={to}
              granularity={granularity}
              onFrom={setFrom}
              onTo={setTo}
              onGranularity={setGranularity}
              error={error || undefined}
            />
            <div className="flex items-end">
              <Button type="submit" className="rounded-full" disabled={report.isFetching}>
                Xem báo cáo
              </Button>
            </div>
          </form>
        </Panel>
        <p className="text-sm text-muted-foreground">
          Gồm cả ngày đầu và cuối, tối đa 366 ngày. Bấm “Xem báo cáo” để áp dụng bộ lọc.
        </p>
        {appliedError && <Alert tone="danger">{appliedError}</Alert>}
        {report.isFetching && <p role="status">Đang tải báo cáo…</p>}
        {report.isError && (
          <Alert tone="danger">
            <p>{getErrorMessage(report.error)}</p>
            <Button variant="secondary" onClick={() => void report.refetch()}>
              Thử lại
            </Button>
          </Alert>
        )}
        {report.data && !report.isError && <Report data={report.data} />}
      </div>
    </PageContainer>
  )
}
function Block({
  title,
  available,
  children,
}: {
  title: string
  available: boolean
  children?: ReactNode
}) {
  return (
    <section className="min-w-0" aria-label={title}>
      <Panel title={title}>
        <div className="min-w-0 space-y-3 break-words">
          {available ? children : <p>Chưa có dữ liệu nguồn cho mục này</p>}
        </div>
      </Panel>
    </section>
  )
}
function Counts({
  values,
  labels = {},
}: {
  values: Record<string, number | null>
  labels?: Record<string, string>
}) {
  return (
    <dl className="space-y-2">
      {Object.entries(values).map(([key, value]) => (
        <div key={key} className="flex min-w-0 justify-between gap-4">
          <dt className="min-w-0 break-words">{revenueLabel(labels, key)}</dt>
          <dd className="shrink-0 tabular-nums">
            {value === null ? 'Không xác định' : new Intl.NumberFormat('vi-VN').format(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}
function Report({ data: d }: { data: OperationalReport }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Kỳ {displayReportDay(d.period.from)} – {displayReportDay(d.period.to)} · Cập nhật lúc{' '}
        {revenueTime(d.generatedAt)}
      </p>
      <section className="space-y-4" aria-labelledby="operational-period-heading">
        <h2 id="operational-period-heading" className="text-2xl font-semibold">
          Theo kỳ đã chọn
        </h2>
        {d.period.granularity === 'month' && (
          <p>Tháng đầu và cuối chỉ tính các ngày trong kỳ đã chọn.</p>
        )}
        {!d.hasPeriodData ? (
          <Alert tone="info">Không có dữ liệu vận hành trong kỳ đã chọn</Alert>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Block title="Đặt phòng" available={d.bookings.available}>
                {d.bookings.available && (
                  <Counts
                    values={{
                      'Tạo mới': d.bookings.created,
                      'Nhận phòng': d.bookings.checkedIn,
                      'Trả phòng': d.bookings.checkedOut,
                      'Đã hủy': d.bookings.cancelled,
                    }}
                  />
                )}
              </Block>
              <Block title="Công suất phòng (ước tính)" available={d.occupancy.available}>
                {d.occupancy.available && (
                  <>
                    <p className="text-2xl font-semibold">{operationalPercent(d.occupancy.rate)}</p>
                    <Counts
                      values={{
                        'Đêm-phòng đã ở': d.occupancy.occupiedRoomNights,
                        'Đêm-phòng khả dụng': d.occupancy.availableRoomNights,
                      }}
                    />
                    <p className="text-sm text-muted-foreground">{d.occupancy.note}</p>
                    {d.occupancy.rate !== null && d.occupancy.rate > 1 && (
                      <Alert tone="warning">
                        Công suất ước tính vượt 100%. Cần kiểm tra dữ liệu và số phòng hiện tại.
                      </Alert>
                    )}
                  </>
                )}
              </Block>
              <Block title="Yêu cầu dịch vụ" available={d.serviceOrders.available}>
                {d.serviceOrders.available && (
                  <>
                    <Counts values={{ 'Yêu cầu trong kỳ': d.serviceOrders.created }} />
                    <h4 className="font-semibold">Tiếp nhận</h4>
                    <Counts values={d.serviceOrders.byReviewStatus} labels={REVIEW_LABELS} />
                    <h4 className="font-semibold">Thực hiện</h4>
                    <Counts values={d.serviceOrders.byExecutionStatus} labels={EXECUTION_LABELS} />
                  </>
                )}
              </Block>
              <Block title="Sự cố" available={d.issues.available}>
                {d.issues.available && (
                  <>
                    <Counts
                      values={{
                        'Được báo': d.issues.reported,
                        'Đã đóng trong kỳ': d.issues.closed,
                        'Xử lý trung bình (giờ)': d.issues.avgResolutionHours,
                      }}
                    />
                    <Counts values={d.issues.byStatus} labels={ISSUE_LABELS} />
                    <h4 className="font-semibold">Theo danh mục</h4>
                    <Counts
                      values={Object.fromEntries(
                        d.issues.byCategory.map((r) => [r.category, r.count]),
                      )}
                    />
                  </>
                )}
              </Block>
              <Block title="Bảo trì" available={d.maintenance.available}>
                {d.maintenance.available && (
                  <>
                    <Counts
                      values={{
                        'Được báo': d.maintenance.reported,
                        'Ngăn dùng phòng an toàn': d.maintenance.preventsSafeUse,
                        'Cần xử lý': d.maintenance.requiresAction,
                      }}
                    />
                    <Counts
                      values={d.maintenance.byStatus}
                      labels={{ ...TASK_LABELS, NO_ACTION: 'Không cần xử lý' }}
                    />
                    {d.maintenance.unknownStatus > 0 && (
                      <Counts values={{ 'Không xác định': d.maintenance.unknownStatus }} />
                    )}
                  </>
                )}
              </Block>
              <Block title="Task trong kỳ" available={d.tasks.available}>
                {d.tasks.available && (
                  <>
                    <Counts
                      values={{
                        'Được giao': d.tasks.period.assigned,
                        'Hoàn thành': d.tasks.period.completed,
                        'Hoàn thành trung bình (giờ)': d.tasks.period.avgCompletionHours,
                      }}
                    />
                    <h4 className="font-semibold">Theo loại task</h4>
                    <Counts
                      values={Object.fromEntries(
                        d.tasks.period.byTaskType.map((r) => [r.taskType, r.count]),
                      )}
                    />
                    <h4 className="font-semibold">Theo nguồn</h4>
                    <Counts
                      values={Object.fromEntries(
                        d.tasks.period.bySourceType.map((r) => [r.sourceType, r.count]),
                      )}
                      labels={SOURCE_LABELS}
                    />
                  </>
                )}
              </Block>
            </div>
            <p className="text-sm text-muted-foreground">
              Mỗi số đếm theo thời điểm sự kiện riêng. Phân bố trạng thái hiện tại áp dụng cho bản
              ghi được báo/yêu cầu/giao trong kỳ. Trung bình chỉ tính bản ghi đóng/hoàn thành trong
              kỳ có thời gian hợp lệ.
            </p>
            <Series rows={d.series} />
          </>
        )}
        {!d.hasPeriodData &&
          [d.bookings, d.occupancy, d.serviceOrders, d.issues, d.maintenance, d.tasks].some(
            (source) => !source.available,
          ) && <p>Chưa có dữ liệu nguồn cho một số mục trong kỳ.</p>}
      </section>
      <section className="space-y-4" aria-labelledby="operational-snapshot-heading">
        <h2 id="operational-snapshot-heading" className="text-2xl font-semibold">
          Tại thời điểm xem báo cáo
        </h2>
        <p>
          Ảnh chụp hiện tại, không bị lọc theo kỳ đã chọn. Các nguồn được đọc riêng, không phải ảnh
          chụp giao dịch đồng thời.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Block title="Phòng hiện tại" available={d.roomsSnapshot.available}>
            {d.roomsSnapshot.available && (
              <>
                <p>Cập nhật lúc {revenueTime(d.roomsSnapshot.asOf)}</p>
                <Counts values={{ 'Phòng đang hoạt động': d.roomsSnapshot.activeTotal }} />
                <Counts values={d.roomsSnapshot.byStatus} labels={ROOM_LABELS} />
              </>
            )}
          </Block>
          <Block title="Task hiện tại" available={d.tasks.available}>
            {d.tasks.available && (
              <>
                <p>Cập nhật lúc {revenueTime(d.tasks.snapshot.asOf)}</p>
                <Counts
                  values={{
                    'Đã giao': d.tasks.snapshot.assigned,
                    'Đang xử lý': d.tasks.snapshot.inProgress,
                    'Quá hạn': d.tasks.snapshot.overdue,
                  }}
                />
              </>
            )}
          </Block>
        </div>
      </section>
    </>
  )
}
function Series({ rows }: { rows: OperationalReport['series'] }) {
  const [metric, setMetric] = useState<keyof typeof METRICS>('bookingsCreated')
  return (
    <section className="space-y-4" aria-label="Chuỗi thời gian vận hành">
      <h3 className="text-xl font-semibold">Chuỗi thời gian</h3>
      <FormField label="Chỉ số biểu đồ" htmlFor="operational-metric" className="min-w-0">
        <NativeSelect
          id="operational-metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value as typeof metric)}
        >
          {Object.entries(METRICS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <Panel>
        <figure>
          <ReportBarChart
            rows={rows.map((row) => ({ bucket: row.bucket, value: row[metric] }))}
            label={`Biểu đồ ${METRICS[metric]}; dữ liệu đầy đủ trong bảng bên dưới`}
          />
          <figcaption className="mt-2 text-sm text-muted-foreground">
            Cột biểu thị số lượng; bảng có đầy đủ sáu chỉ số, gồm cả kỳ bằng 0.
          </figcaption>
        </figure>
      </Panel>
      <DataTable
        rows={rows.map((row) => ({ ...row, id: row.bucket }))}
        showPagination={false}
        caption="Dữ liệu vận hành theo thời gian"
        scrollLabel="Bảng dữ liệu vận hành theo thời gian"
        columns={[
          {
            key: 'bucket',
            header: 'Kỳ',
            rowHeader: true,
            render: (row) => revenueBucketLabel(row.bucket),
          },
          ...(Object.keys(METRICS) as (keyof typeof METRICS)[]).map((key) => ({
            key,
            header: METRICS[key],
            className: 'text-right tabular-nums',
          })),
        ]}
      />
    </section>
  )
}
