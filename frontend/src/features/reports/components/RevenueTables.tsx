import { DataTable, Panel } from '@/components/organisms'
import { ReportBarChart } from './ReportBarChart'
import type { RevenueReport } from '../api'
import { revenueBucketLabel, revenueMoney } from '../presentation'

export function RevenueSeries({ series }: Pick<RevenueReport, 'series'>) {
  return (
    <section aria-labelledby="revenue-series-heading" className="space-y-4">
      <h2 id="revenue-series-heading" className="text-xl font-semibold">
        Thực thu theo thời gian
      </h2>
      <Panel>
        <figure>
          <ReportBarChart
            rows={series.map((row) => ({ bucket: row.bucket, value: row.successAmount }))}
            label="Biểu đồ cột thực thu theo kỳ; số liệu đầy đủ trong bảng bên dưới"
            format={revenueMoney}
          />
          <figcaption className="mt-2 text-sm text-muted-foreground">
            Chiều cao cột biểu thị tiền thực thu. Bảng dưới đây có đầy đủ từng kỳ, gồm cả kỳ bằng 0.
          </figcaption>
        </figure>
      </Panel>
      <DataTable
        rows={series.map((row) => ({ ...row, id: row.bucket }))}
        showPagination={false}
        caption="Dữ liệu thực thu theo thời gian"
        scrollLabel="Bảng thực thu theo thời gian"
        columns={[
          {
            key: 'bucket',
            header: 'Kỳ',
            rowHeader: true,
            render: (row) => revenueBucketLabel(row.bucket),
          },
          {
            key: 'successCount',
            header: 'Giao dịch thành công',
            className: 'text-right tabular-nums',
          },
          {
            key: 'successAmount',
            header: 'Thực thu (VND)',
            className: 'text-right tabular-nums',
            render: (row) => revenueMoney(row.successAmount),
          },
        ]}
      />
    </section>
  )
}
export function RevenueBreakdown({
  title,
  rows,
}: {
  title: string
  rows: { label: string; successCount: number; successAmount: number }[]
}) {
  return (
    <section className="min-w-0 space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <DataTable
        rows={rows.map((row) => ({ ...row, id: row.label }))}
        showPagination={false}
        caption={title}
        scrollLabel={`Bảng ${title.toLowerCase()}`}
        columns={[
          {
            key: 'label',
            header: 'Phân loại',
            rowHeader: true,
            className: 'min-w-32 max-w-48 break-words',
          },
          { key: 'successCount', header: 'Thành công', className: 'text-right tabular-nums' },
          {
            key: 'successAmount',
            header: 'Thực thu (VND)',
            className: 'text-right tabular-nums',
            render: (row) => revenueMoney(row.successAmount),
          },
        ]}
      />
    </section>
  )
}
