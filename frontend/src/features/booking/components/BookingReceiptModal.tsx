import { useState } from 'react'
import { CheckCircle2, Mail, Printer } from 'lucide-react'
import { Button, Input } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { env } from '@/lib/env'
import type { BookingListItem, BookingSummary, InvoiceTotals } from '../api'
import { useBookingSummary, useSendInvoiceEmail } from '../hooks'
import { formatDate, formatDateTime, money, nightsBetween } from '../utils'

export interface BookingReceiptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  bookingCode: string
  /** Thông tin chi tiết nếu caller đã có sẵn (ví dụ màn ReceptionBookingDetailPage). */
  summary?: BookingSummary
  /** Thông tin danh sách nếu caller truyền từ CheckoutCharges. */
  bookingItem?: BookingListItem
  totals?: InvoiceTotals
  charges?: { reason: string; amount: number }[]
  paymentMethod?: string
}

export function BookingReceiptModal({
  open,
  onOpenChange,
  bookingId,
  bookingCode,
  summary: propSummary,
  bookingItem,
  totals: propTotals,
  charges: propCharges,
  paymentMethod,
}: BookingReceiptModalProps) {
  // Tải thêm summary nếu caller chỉ truyền id/code hoặc dữ liệu chưa đầy đủ
  const summaryQuery = useBookingSummary(open && !propSummary ? bookingId : '')
  const summary = propSummary ?? summaryQuery.data

  const sendEmail = useSendInvoiceEmail()
  const [customEmail, setCustomEmail] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [sentMessage, setSentMessage] = useState('')

  const guestName = summary?.guest.name ?? bookingItem?.guestName ?? ''
  const guestEmail = summary?.guest.email ?? bookingItem?.guestEmail ?? ''
  const guestPhone = summary?.guest.phone ?? bookingItem?.guestPhone ?? ''
  const checkIn = summary?.checkIn ?? bookingItem?.checkIn ?? ''
  const checkOut = summary?.checkOut ?? bookingItem?.checkOut ?? ''
  const nights = nightsBetween(checkIn, checkOut)

  const roomNumbers =
    summary?.rooms
      ?.map((room) => room.roomNumber)
      .filter(Boolean)
      .join(', ') ||
    bookingItem?.rooms
      ?.map((room) => room.roomNumber)
      .filter(Boolean)
      .join(', ') ||
    ''

  const roomTypeName = summary?.rooms?.map((room) => room.roomTypeName).filter(Boolean)[0] || ''

  const invoice = summary?.invoice ??
    propTotals ?? {
      roomTotal: bookingItem?.roomTotal ?? 0,
      serviceTotal: 0,
      additionalTotal: 0,
      totalAmount: bookingItem?.roomTotal ?? 0,
      depositPaid: 0,
      finalPaid: 0,
      balanceDue: 0,
    }

  const items = []
  let no = 1

  // 1. Tiền phòng
  if (invoice.roomTotal > 0 || nights > 0) {
    items.push({
      no: no++,
      description: `Tiền phòng${roomTypeName ? ` · ${roomTypeName}` : ''}${roomNumbers ? ` (${roomNumbers})` : ''}`,
      quantity: `${nights} đêm`,
      unitPrice: nights > 0 ? Math.round(invoice.roomTotal / nights) : invoice.roomTotal,
      total: invoice.roomTotal,
    })
  }

  // 2. Dịch vụ phát sinh
  if (summary?.serviceOrders?.length) {
    for (const order of summary.serviceOrders) {
      if (order.status !== 'CANCELLED' && order.amount > 0) {
        items.push({
          no: no++,
          description: order.serviceName,
          quantity: order.quantity,
          unitPrice: Math.round(order.amount / Math.max(1, order.quantity)),
          total: order.amount,
        })
      }
    }
  } else if (invoice.serviceTotal > 0) {
    items.push({
      no: no++,
      description: 'Dịch vụ phát sinh',
      quantity: 1,
      unitPrice: invoice.serviceTotal,
      total: invoice.serviceTotal,
    })
  }

  // 3. Phụ phí
  if (propCharges?.length) {
    for (const charge of propCharges) {
      if (charge.amount > 0) {
        items.push({
          no: no++,
          description: charge.reason || 'Phụ phí',
          quantity: 1,
          unitPrice: charge.amount,
          total: charge.amount,
        })
      }
    }
  } else if (invoice.additionalTotal > 0) {
    items.push({
      no: no++,
      description: 'Phụ phí bổ sung',
      quantity: 1,
      unitPrice: invoice.additionalTotal,
      total: invoice.additionalTotal,
    })
  }

  const effectiveEmail = customEmail.trim() || guestEmail.trim()

  async function handleSendEmail() {
    if (!effectiveEmail) {
      setShowEmailInput(true)
      return
    }
    setSentMessage('')
    try {
      const res = await sendEmail.mutateAsync({
        bookingId,
        email: customEmail.trim() || undefined,
      })
      setSentMessage(`Đã gửi phiếu thanh toán đến ${res.recipient} thành công!`)
      setShowEmailInput(false)
    } catch {
      // Lỗi hiển thị qua sendEmail.error
    }
  }

  const [receiptDate] = useState(() => formatDateTime(new Date().toISOString()))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="print:hidden">
          <DialogTitle>Xuất hoá đơn / Phiếu thanh toán</DialogTitle>
          <DialogDescription>
            Xem trước phiếu thanh toán, in ra giấy / lưu file PDF hoặc gửi về email cho khách hàng.
          </DialogDescription>
        </DialogHeader>

        {/* Thanh công cụ thao tác phía trên (chỉ hiện trên màn hình, ẩn khi in) */}
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className="gap-2 rounded-full" onClick={() => window.print()}>
                <Printer className="size-4" />
                In / Xuất PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 rounded-full"
                disabled={sendEmail.isPending}
                onClick={handleSendEmail}
              >
                <Mail className="size-4" />
                {sendEmail.isPending ? 'Đang gửi…' : 'Gửi email cho khách'}
              </Button>
              {!showEmailInput && guestEmail && (
                <button
                  type="button"
                  onClick={() => setShowEmailInput(true)}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Đổi email nhận ({guestEmail})
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Đóng
            </Button>
          </div>

          {showEmailInput && (
            <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border">
              <div className="w-64">
                <FormField label="Email nhận hoá đơn" htmlFor="custom-receipt-email">
                  <Input
                    id="custom-receipt-email"
                    type="email"
                    placeholder="khachhang@example.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                  />
                </FormField>
              </div>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={!effectiveEmail || sendEmail.isPending}
                onClick={handleSendEmail}
              >
                Gửi ngay
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => setShowEmailInput(false)}
              >
                Hủy
              </Button>
            </div>
          )}

          {sentMessage && (
            <Alert tone="success" className="py-2 text-xs">
              <CheckCircle2 className="size-4" />
              {sentMessage}
            </Alert>
          )}

          {sendEmail.isError && (
            <Alert tone="danger" className="py-2 text-xs">
              {getErrorMessage(sendEmail.error, 'Không thể gửi email hoá đơn.')}
            </Alert>
          )}
        </div>

        {/* Khung hiển thị Receipt (in ra A4 hoặc PDF đúng mẫu người dùng cung cấp) */}
        <div className="overflow-x-auto py-2">
          <div
            id="printable-receipt"
            className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-card p-8 text-foreground shadow-sm sm:p-10 print:m-0 print:max-w-none print:border-none print:bg-white print:p-0 print:text-zinc-900 print:shadow-none"
          >
            {/* 1. Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight uppercase text-foreground print:text-zinc-900">
                  RECEIPT
                </h1>
                <p className="mt-1 text-sm font-bold text-foreground print:text-zinc-900">
                  {env.appName || 'Grand Emily Hotel'}
                </p>
                <p className="text-xs text-muted-foreground print:text-zinc-500">
                  contact@grandemily.local
                </p>
                <p className="text-xs text-muted-foreground print:text-zinc-500">
                  01 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội
                </p>
              </div>

              <div className="text-right">
                <div className="mb-2 flex justify-end">
                  {/* The brand mark from public/; an <img> prints reliably, unlike CSS backgrounds. */}
                  <img src="/favicon.svg" alt={env.appName} className="size-14 rounded-xl" />
                </div>
                <p className="text-xs text-muted-foreground print:text-zinc-500">
                  Receipt #:{' '}
                  <span className="font-bold text-foreground print:text-zinc-900">
                    #{bookingCode}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground print:text-zinc-500">
                  Receipt Date:{' '}
                  <span className="font-medium text-foreground print:text-zinc-800">
                    {receiptDate}
                  </span>
                </p>
              </div>
            </div>

            {/* 2. Customer Details */}
            <div className="mt-8 text-left">
              <h3 className="text-xs font-bold tracking-wider text-foreground print:text-zinc-900 uppercase">
                Customer Details:
              </h3>
              <p className="mt-1 text-sm font-semibold text-foreground print:text-zinc-900">
                {guestName || 'Khách vãng lai'}
              </p>
              <p className="text-xs text-muted-foreground print:text-zinc-500">
                {[guestPhone, guestEmail].filter(Boolean).join(' · ') ||
                  'Chưa có thông tin liên hệ'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground print:text-zinc-600">
                Phòng:{' '}
                <span className="font-medium text-foreground print:text-zinc-900">
                  {roomNumbers || 'Chưa gán'}
                </span>
                {roomTypeName ? ` (${roomTypeName})` : ''} · {nights} đêm ({formatDate(checkIn)} →{' '}
                {formatDate(checkOut)})
              </p>
            </div>

            {/* 3. Itemized Table */}
            <div className="mt-6 overflow-hidden rounded-lg border border-border print:border-zinc-300">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/60 font-bold text-foreground print:border-zinc-300 print:bg-zinc-100 print:text-zinc-900">
                    <th className="w-10 px-3 py-2.5 text-center">No.</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="w-24 px-3 py-2.5 text-center">Quantity</th>
                    <th className="w-28 px-3 py-2.5 text-right">Unit Price</th>
                    <th className="w-28 px-3 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground print:divide-zinc-200 print:text-zinc-800">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/20 print:hover:bg-transparent">
                      <td className="px-3 py-2.5 text-center font-medium text-muted-foreground print:text-zinc-500">
                        {item.no}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{item.description}</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground print:text-zinc-600">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {money.format(item.unitPrice)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-foreground print:text-zinc-900">
                        {money.format(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 4. Notes and Totals */}
            <div className="mt-6 flex items-start justify-between gap-6">
              <div className="max-w-[260px] text-left">
                <h4 className="mb-1 text-xs font-bold tracking-wider text-foreground print:text-zinc-900 uppercase">
                  Note:
                </h4>
                <p className="text-xs text-muted-foreground print:text-zinc-500 leading-relaxed">
                  {invoice.balanceDue === 0
                    ? 'Đã hoàn tất thanh toán toàn bộ chi phí.'
                    : `Còn lại cần thanh toán: ${money.format(invoice.balanceDue)}.`}
                </p>
                {paymentMethod && (
                  <p className="mt-1 text-xs text-muted-foreground print:text-zinc-500">
                    Phương thức: {paymentMethod}
                  </p>
                )}
              </div>

              <div className="w-60 space-y-1.5 text-xs text-right">
                <div className="flex justify-between text-muted-foreground print:text-zinc-600">
                  <span>Sub Total:</span>
                  <span className="font-medium text-foreground print:text-zinc-900 tabular-nums">
                    {money.format(invoice.totalAmount)}
                  </span>
                </div>
                {invoice.depositPaid > 0 && (
                  <div className="flex justify-between text-muted-foreground print:text-zinc-600">
                    <span>Deposit Paid:</span>
                    <span className="font-medium text-foreground print:text-zinc-900 tabular-nums">
                      -{money.format(invoice.depositPaid)}
                    </span>
                  </div>
                )}
                {/* Khối bo tròn màu đen nổi bật theo đúng mẫu ảnh */}
                <div className="mt-2 flex items-center justify-between rounded-lg bg-foreground px-4 py-2.5 text-sm font-bold text-background shadow-sm print:bg-zinc-900 print:text-white">
                  <span>Total:</span>
                  <span className="tabular-nums">
                    {money.format(
                      invoice.balanceDue === 0 ? invoice.totalAmount : invoice.balanceDue,
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Footer */}
            <div className="mt-14 border-t border-border pt-5 text-center print:border-zinc-200">
              <p className="text-sm font-semibold tracking-wide text-foreground print:text-zinc-800">
                Thank you for staying with us!
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
