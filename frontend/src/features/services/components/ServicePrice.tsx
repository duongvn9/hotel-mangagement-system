const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})
export function ServicePrice({ price, unit }: { price: number | null; unit: string }) {
  return (
    <span className="whitespace-nowrap">
      {price === null ? '—' : vnd.format(price)}
      {unit ? ` / ${unit}` : ''}
    </span>
  )
}
