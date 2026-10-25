import { revenueBucketLabel } from '../presentation'
export function ReportBarChart({
  rows,
  label,
  format = String,
}: {
  rows: { bucket: string; value: number }[]
  label: string
  format?: (value: number) => string
}) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  const step = 1000 / Math.max(1, rows.length)
  return (
    <svg viewBox="0 0 1040 240" role="img" aria-label={label} className="w-full text-primary">
      <line x1="20" y1="205" x2="1020" y2="205" stroke="currentColor" />
      {rows.map((row, index) => (
        <g key={row.bucket}>
          <rect
            x={20 + index * step + step * 0.15}
            y={205 - (row.value / max) * 170}
            width={Math.max(0.5, step * 0.7)}
            height={(row.value / max) * 170}
            fill="currentColor"
          >
            <title>
              {revenueBucketLabel(row.bucket)}: {format(row.value)}
            </title>
          </rect>
          {index % Math.max(1, Math.ceil(rows.length / 8)) === 0 && (
            <text x={20 + index * step} y="230" fontSize="13" fill="currentColor">
              {revenueBucketLabel(row.bucket)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
