import { ReportBarChart } from './ReportBarChart'
import type { RevenueReport } from '../api'
import { revenueBucketLabel, revenueMoney } from '../presentation'
export function RevenueSeries({ series }: Pick<RevenueReport, 'series'>) {
  return (
    <section className="space-y-4" aria-labelledby="revenue-series-heading">
      <h2 id="revenue-series-heading" className="text-xl font-semibold">
        Thực thu theo thời gian
      </h2>
      <figure className="rounded border border-stone-300 bg-white p-4">
        <ReportBarChart
          rows={series.map((row) => ({ bucket: row.bucket, value: row.successAmount }))}
          label="Biểu đồ cột thực thu theo kỳ; số liệu đầy đủ trong bảng bên dưới"
          format={revenueMoney}
        />
        <figcaption className="mt-2 text-sm text-stone-700">
          Chiều cao cột biểu thị tiền thực thu. Bảng dưới đây có đầy đủ từng kỳ, gồm cả kỳ bằng 0.
        </figcaption>
      </figure>
      <div className="overflow-x-auto rounded border border-stone-300">
        <table
          className="w-full min-w-[420px] text-sm"
          aria-label="Dữ liệu thực thu theo thời gian"
        >
          <thead className="bg-stone-200">
            <tr>
              <th scope="col" className="p-3 text-left">
                Kỳ
              </th>
              <th scope="col" className="p-3 text-right">
                Giao dịch thành công
              </th>
              <th scope="col" className="p-3 text-right">
                Thực thu (VND)
              </th>
            </tr>
          </thead>
          <tbody>
            {series.map((row) => (
              <tr key={row.bucket} className="border-t border-stone-300 bg-white">
                <th scope="row" className="p-3 text-left font-normal">
                  {revenueBucketLabel(row.bucket)}
                </th>
                <td className="p-3 text-right tabular-nums">{row.successCount}</td>
                <td className="p-3 text-right tabular-nums">{revenueMoney(row.successAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      <div className="overflow-x-auto rounded border border-stone-300">
        <table aria-label={title} className="w-full min-w-[360px] text-sm">
          <thead className="bg-stone-200">
            <tr>
              <th scope="col" className="p-3 text-left">
                Phân loại
              </th>
              <th scope="col" className="p-3 text-right">
                Thành công
              </th>
              <th scope="col" className="p-3 text-right">
                Thực thu (VND)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-stone-300 bg-white">
                <th scope="row" className="p-3 text-left font-normal">
                  {row.label}
                </th>
                <td className="p-3 text-right tabular-nums">{row.successCount}</td>
                <td className="p-3 text-right tabular-nums">{revenueMoney(row.successAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
