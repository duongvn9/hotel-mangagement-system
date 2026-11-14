import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/atoms'
import { KeyValue } from '@/components/molecules'
import { Panel } from '@/components/organisms'
import { fdate, label, vnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BookingSummary } from '../api'
import { nightsBetween } from '../utils'

const PURPOSE_LABEL: Record<string, string> = {
  DEPOSIT: 'Đặt cọc',
  FINAL: 'Thanh toán phần còn lại',
}

const money = (value: number) => <span className="tabular-nums">{vnd(value)}</span>

interface BookingDetailLayoutProps {
  summary: BookingSummary
  backTo: string
  backLabel: string
  /** Nút thao tác của người xem (đặt cọc, huỷ, sửa...), đặt ở đầu trang. */
  actions?: ReactNode
  /** Thông báo hiện giữa đầu trang và nội dung (đếm ngược giữ phòng, lỗi, ...). */
  notices?: ReactNode
  /** Extra block under the stay details (for example reception's ID photo). */
  evidence?: ReactNode
}

/**
 * Màn chi tiết booking theo prototype app.bookings.$id: đầu trang (mã, trạng thái, nguồn đặt,
 * thao tác) rồi lưu trú, thanh toán, yêu cầu dịch vụ ở cột trái; hoá đơn và khách ở cột phải.
 * Dùng chung cho khách và nhân viên; trang cha lo việc đọc dữ liệu và các thao tác.
 */
export function BookingDetailLayout({
  summary,
  backTo,
  backLabel,
  actions,
  notices,
  evidence,
}: BookingDetailLayoutProps) {
  const nights = nightsBetween(summary.checkIn, summary.checkOut)
  const roomTypes = [...new Set(summary.rooms.map((room) => room.roomTypeName).filter(Boolean))]
  const roomNumbers = summary.rooms.map((room) => room.roomNumber).filter(Boolean)
  const { invoice } = summary
  const paid = invoice.depositPaid + invoice.finalPaid
  const subtitle = [
    summary.guest.name,
    roomTypes.join(', '),
    roomNumbers.length > 0 ? `Phòng ${roomNumbers.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-6">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold break-words">{summary.code}</h1>
            <StatusBadge status={summary.status} />
            {summary.source === 'FRONT_DESK' ? (
              // Chỉ đánh dấu đơn tại quầy chưa liên kết tài khoản (khách vãng lai); đã liên kết thì không cần badge.
              summary.hasAccount ? null : (
                <StatusBadge status="WALK_IN" />
              )
            ) : (
              <StatusBadge status={summary.source} />
            )}
          </div>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      {notices}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <Panel title="Lưu trú">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <KeyValue k="Nhận phòng" v={fdate(summary.checkIn)} />
              <KeyValue k="Trả phòng" v={fdate(summary.checkOut)} />
              <KeyValue k="Số đêm" v={nights} />
              <KeyValue
                k="Số khách"
                v={`${summary.adultCount} người lớn · ${summary.childCount} trẻ em`}
              />
              <KeyValue k="Loại phòng" v={roomTypes.join(', ') || '—'} />
              <KeyValue k="Phòng" v={roomNumbers.join(', ') || '—'} />
              <KeyValue k="Ngày đặt" v={fdate(summary.createdAt)} />
            </div>
          </Panel>

          {evidence}

          <Panel title="Thanh toán">
            {summary.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có thanh toán nào.</p>
            ) : (
              <div className="divide-y">
                {summary.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm"
                  >
                    <span>
                      {PURPOSE_LABEL[payment.purpose] ?? label(payment.purpose)} ·{' '}
                      {label(payment.method)} · {fdate(payment.date)}
                    </span>
                    <span className="flex items-center gap-3">
                      {money(payment.amount)}
                      <StatusBadge status={payment.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Yêu cầu dịch vụ">
            {summary.serviceOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có dịch vụ nào cho kỳ lưu trú này.
              </p>
            ) : (
              <div className="divide-y">
                {summary.serviceOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm"
                  >
                    <span className="break-words">
                      {order.serviceName} × {order.quantity}
                    </span>
                    <span className="flex items-center gap-3">
                      {money(order.amount)}
                      <StatusBadge status={order.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid h-fit gap-6">
          <Panel title="Hoá đơn">
            <div className="divide-y">
              <KeyValue k={`Tiền phòng · ${nights} đêm`} v={money(invoice.roomTotal)} />
              <KeyValue k="Dịch vụ" v={money(invoice.serviceTotal)} />
              {invoice.additionalTotal > 0 && (
                <KeyValue k="Phụ phí" v={money(invoice.additionalTotal)} />
              )}
              <KeyValue k="Tiền cọc" v={money(summary.depositAmount)} />
              <KeyValue k="Đã thanh toán" v={money(paid)} />
              <KeyValue
                k="Còn lại"
                v={
                  <span
                    className={cn(
                      'tabular-nums',
                      invoice.balanceDue > 0 ? 'text-primary' : 'text-success',
                    )}
                  >
                    {vnd(Math.max(0, invoice.balanceDue))}
                  </span>
                }
              />
            </div>
          </Panel>

          <Panel title="Khách">
            <div className="divide-y">
              <KeyValue
                k="Tên"
                v={<span className="break-words">{summary.guest.name || '—'}</span>}
              />
              <KeyValue
                k="Email"
                v={<span className="break-all">{summary.guest.email || '—'}</span>}
              />
              <KeyValue k="Điện thoại" v={summary.guest.phone || '—'} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
