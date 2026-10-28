export const METHOD_LABELS = { VNPAY: 'VNPay', CASH: 'Tiền mặt' }
export const PURPOSE_LABELS = { DEPOSIT: 'Cọc', FINAL: 'Thanh toán cuối' }
export const PAYMENT_STATUS_LABELS = {
  PENDING: 'Đang chờ',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  CANCELLED: 'Bị hủy',
}
export const revenueLabel = (labels: Record<string, string>, value: string) =>
  Object.hasOwn(labels, value) ? labels[value] : value
export const revenueMoney = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`
const business = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
export function defaultRevenuePeriod(now = new Date()) {
  const to = business.format(now)
  return { from: `${to.slice(0, 7)}-01`, to }
}
export const displayReportDay = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso
export function parseReportDay(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return undefined
  const iso = value.split('/').reverse().join('-')
  const date = new Date(`${iso}T00:00:00+07:00`)
  return Number.isFinite(date.getTime()) && business.format(date) === iso ? iso : undefined
}
export function reportInputError(from: string, to: string) {
  const a = parseReportDay(from),
    b = parseReportDay(to)
  if (!a || !b) return 'Nhập ngày hợp lệ theo dd/MM/yyyy.'
  if (a > b) return 'Ngày từ phải trước hoặc bằng ngày đến.'
  if (
    (new Date(`${b}T00:00:00+07:00`).getTime() - new Date(`${a}T00:00:00+07:00`).getTime()) /
      86400000 +
      1 >
    366
  )
    return 'Kỳ báo cáo không quá 366 ngày.'
  return ''
}
export const revenueBucketLabel = (value: string) => value.split('-').reverse().join('/')
export const revenueTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
