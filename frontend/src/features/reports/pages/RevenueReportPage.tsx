import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Badge, Button, NativeSelect } from '@/components/atoms'
import { Alert, FormField, StatCard } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { ReportPeriodFields } from '../components/ReportPeriodFields'
import { getErrorMessage } from '@/lib/api-client'
import type { RevenueQuery } from '../api'
import { useRevenueReport } from '../hooks'
import {
  defaultRevenuePeriod,
  displayReportDay,
  parseReportDay,
  reportInputError,
  METHOD_LABELS,
  PURPOSE_LABELS,
  PAYMENT_STATUS_LABELS,
  revenueLabel,
  revenueMoney,
  revenueTime,
} from '../presentation'
import { RevenueBreakdown, RevenueSeries } from '../components/RevenueTables'

export function RevenueReportPage() {
  const [params] = useSearchParams()
  return <RevenueReportContent key={params.toString()} />
}
function RevenueReportContent() {
  const [params, setParams] = useSearchParams()
  const [defaults] = useState(defaultRevenuePeriod)
  const query: RevenueQuery = {
    from: params.get('from') ?? defaults.from,
    to: params.get('to') ?? defaults.to,
    granularity: (params.get('granularity') ?? 'day') as RevenueQuery['granularity'],
    method: (params.get('method') || undefined) as RevenueQuery['method'],
    purpose: (params.get('purpose') || undefined) as RevenueQuery['purpose'],
  }
  const [from, setFrom] = useState(displayReportDay(query.from)),
    [to, setTo] = useState(displayReportDay(query.to))
  const [granularity, setGranularity] = useState(query.granularity),
    [method, setMethod] = useState(query.method ?? ''),
    [purpose, setPurpose] = useState(query.purpose ?? '')
  const [submitted, setSubmitted] = useState(false)
  const error = reportInputError(from, to)
  const appliedError = reportInputError(displayReportDay(query.from), displayReportDay(query.to))
  const report = useRevenueReport(query, !appliedError)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (error) {
      event.currentTarget.querySelector('input')?.focus()
      return
    }
    const next = new URLSearchParams({
      from: parseReportDay(from)!,
      to: parseReportDay(to)!,
      granularity,
    })
    if (method) next.set('method', method)
    if (purpose) next.set('purpose', purpose)
    if (
      query.from === next.get('from') &&
      query.to === next.get('to') &&
      query.granularity === granularity &&
      (query.method ?? '') === method &&
      (query.purpose ?? '') === purpose
    )
      void report.refetch()
    else setParams(next)
  }
  const data = report.data
  const total = data?.totals
  const empty =
    total &&
    total.successCount +
      total.failedCount +
      total.cancelledCount +
      total.pendingCount +
      total.anomalies.count ===
      0
  return (
    <PageContainer>
      <PageHeader
        title="Báo cáo doanh thu"
        subtitle="Tiền thực thu từ giao dịch đã ghi nhận. Cọc và thanh toán cuối được trình bày riêng."
      />
      <div className="space-y-6">
        <Panel>
          <form
            onSubmit={submit}
            noValidate
            aria-label="Bộ lọc báo cáo doanh thu"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <ReportPeriodFields
              from={from}
              to={to}
              granularity={granularity}
              onFrom={setFrom}
              onTo={setTo}
              onGranularity={setGranularity}
              error={submitted ? error || undefined : undefined}
            />
            <FormField label="Phương thức thanh toán" htmlFor="revenue-method" className="min-w-0">
              <NativeSelect
                id="revenue-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
              >
                {[
                  { value: '', label: 'Tất cả phương thức' },
                  ...Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label })),
                ].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Mục đích" htmlFor="revenue-purpose" className="min-w-0">
              <NativeSelect
                id="revenue-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as typeof purpose)}
              >
                {[
                  { value: '', label: 'Tất cả mục đích' },
                  ...Object.entries(PURPOSE_LABELS).map(([value, label]) => ({ value, label })),
                ].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <div className="flex items-end">
              <Button type="submit" className="rounded-full" disabled={report.isFetching}>
                Xem báo cáo
              </Button>
            </div>
          </form>
        </Panel>
        <p className="text-sm text-muted-foreground">
          Ngày theo giờ Việt Nam, gồm cả ngày đầu và cuối, tối đa 366 ngày. Bấm “Xem báo cáo” để áp
          dụng bộ lọc.
        </p>
        {appliedError && <Alert tone="danger">{appliedError}</Alert>}
        {report.isFetching && <p role="status">Đang tải báo cáo…</p>}
        {report.isError && (
          <Alert tone="danger">
            <p>{getErrorMessage(report.error)}</p>
            <Button type="button" variant="secondary" onClick={() => void report.refetch()}>
              Thử lại
            </Button>
          </Alert>
        )}
        {data && total && !report.isError && (
          <>
            <div aria-live="polite" className="text-sm text-muted-foreground">
              Kỳ {displayReportDay(data.period.from)} – {displayReportDay(data.period.to)} · Cập
              nhật lúc {revenueTime(data.generatedAt)}
            </div>
            {data.period.granularity === 'month' && (
              <p className="text-sm text-muted-foreground">
                Tháng đầu và cuối chỉ tính các ngày trong kỳ đã chọn.
              </p>
            )}
            {total.anomalies.count > 0 && (
              <Alert tone="warning">
                Có {total.anomalies.count} giao dịch dữ liệu không hợp lệ bị loại khỏi doanh thu
              </Alert>
            )}
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Tổng thực thu"
                value={
                  <span className="block break-words">{revenueMoney(total.successAmount)}</span>
                }
              />
              <StatCard label="Giao dịch thành công" value={String(total.successCount)} />
              <StatCard
                label="Hoàn tiền"
                value={
                  total.refundsSupported && total.refunds ? (
                    revenueMoney(total.refunds.amount)
                  ) : (
                    <span className="block break-words">Chưa hỗ trợ ghi nhận hoàn tiền</span>
                  )
                }
              />
              {total.netAmount !== null && (
                <StatCard
                  label="Thực thu ròng"
                  value={<span className="block break-words">{revenueMoney(total.netAmount)}</span>}
                />
              )}
            </div>
            <section aria-labelledby="excluded-revenue-heading">
              <Panel>
                <div className="space-y-2">
                  <h2 id="excluded-revenue-heading" className="text-lg font-semibold">
                    Không tính vào doanh thu
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    <Badge tone="danger">
                      {PAYMENT_STATUS_LABELS.FAILED}: {total.failedCount}
                    </Badge>
                    <Badge tone="neutral">
                      {PAYMENT_STATUS_LABELS.CANCELLED}: {total.cancelledCount}
                    </Badge>
                    <Badge tone="neutral">
                      {PAYMENT_STATUS_LABELS.PENDING}: {total.pendingCount}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Thất bại, bị hủy và đang chờ được đếm theo ngày tạo giao dịch, không phải ngày
                    thanh toán. SUCCESS thiếu ngày thanh toán được cảnh báo theo ngày tạo.
                  </p>
                </div>
              </Panel>
            </section>
            {empty ? (
              <Alert tone="info">Không có giao dịch trong kỳ đã chọn</Alert>
            ) : (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <RevenueBreakdown
                    title="Theo phương thức"
                    rows={data.byMethod.map((row) => ({
                      ...row,
                      label: revenueLabel(METHOD_LABELS, row.method),
                    }))}
                  />
                  <RevenueBreakdown
                    title="Theo mục đích"
                    rows={data.byPurpose.map((row) => ({
                      ...row,
                      label: revenueLabel(PURPOSE_LABELS, row.purpose),
                    }))}
                  />
                </div>
                <RevenueSeries series={data.series} />
              </>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
