import { useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useAuth } from '@/features/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
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
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <header>
        <h1 className="font-display text-4xl font-semibold">Báo cáo vận hành</h1>
        <p className="mt-2 text-sm text-stone-700">
          Thống kê từ bản ghi vận hành thực tế, theo ngày Việt Nam.
        </p>
      </header>
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
          <Button type="submit" disabled={report.isFetching}>
            Xem báo cáo
          </Button>
        </div>
      </form>
      <p className="text-sm text-stone-700">
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
    </section>
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
    <section
      className="min-w-0 space-y-3 rounded border border-stone-300 bg-white p-4"
      aria-label={title}
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      {available ? children : <p>Chưa có dữ liệu nguồn cho mục này</p>}
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
        <div key={key} className="flex justify-between gap-4">
          <dt>{revenueLabel(labels, key)}</dt>
          <dd className="tabular-nums">
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
      <p className="text-sm text-stone-700">
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
                    <p className="text-sm text-stone-700">{d.occupancy.note}</p>
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
            <p className="text-sm text-stone-700">
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
      <SelectField
        label="Chỉ số biểu đồ"
        value={metric}
        onChange={(e) => setMetric(e.target.value as typeof metric)}
        options={Object.entries(METRICS).map(([value, label]) => ({ value, label }))}
      />
      <figure>
        <ReportBarChart
          rows={rows.map((row) => ({ bucket: row.bucket, value: row[metric] }))}
          label={`Biểu đồ ${METRICS[metric]}; dữ liệu đầy đủ trong bảng bên dưới`}
        />
        <figcaption>Cột biểu thị số lượng; bảng có đầy đủ sáu chỉ số, gồm cả kỳ bằng 0.</figcaption>
      </figure>
      <div className="overflow-x-auto rounded border border-stone-300">
        <table
          aria-label="Dữ liệu vận hành theo thời gian"
          className="w-full min-w-[760px] text-sm"
        >
          <thead className="bg-stone-200">
            <tr>
              <th scope="col" className="p-3 text-left">
                Kỳ
              </th>
              {Object.values(METRICS).map((label) => (
                <th key={label} scope="col" className="p-3 text-right">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.bucket} className="border-t border-stone-300">
                <th scope="row" className="p-3 text-left">
                  {revenueBucketLabel(row.bucket)}
                </th>
                {(Object.keys(METRICS) as (keyof typeof METRICS)[]).map((key) => (
                  <td key={key} className="p-3 text-right tabular-nums">
                    {row[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
