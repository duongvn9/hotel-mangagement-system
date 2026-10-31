import { useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { BOOKING_STATUS_DISPLAY } from '../api'
import { useReconcilePayment, useReconciliationList } from '../hooks'
import { formatDateTime, money } from '../utils'

/**
 * Issue ② — Hàng đợi đối soát (Manager). Liệt kê các khoản VNPay đã về SUCCESS nhưng
 * booking không còn nhận được (tiền về sau hạn giữ phòng). Việc hoàn tiền thật làm ngoài
 * cổng VNPay; ở đây Manager ghi lại đã xử lý (kèm ghi chú) để khoản rời khỏi hàng đợi.
 */
export function ReconciliationPage() {
  const list = useReconciliationList()
  const reconcile = useReconcilePayment()
  const [notes, setNotes] = useState<Record<string, string>>({})

  async function resolve(id: string) {
    const note = notes[id]?.trim()
    try {
      await reconcile.mutateAsync({ id, ...(note ? { note } : {}) })
      setNotes((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
    } catch {
      // Lỗi hiển thị qua reconcile.isError bên dưới.
    }
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Quản lý</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Đối soát thanh toán</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-700">
          Tiền đã về nhưng phòng không còn được giữ (thanh toán về sau thời hạn). Hãy hoàn tiền cho
          khách qua cổng VNPay rồi đánh dấu đã xử lý tại đây.
        </p>
      </div>

      {reconcile.isError && <Alert tone="danger">{getErrorMessage(reconcile.error)}</Alert>}
      {list.isError && (
        <Alert tone="danger">{getErrorMessage(list.error, 'Không tải được danh sách.')}</Alert>
      )}

      {list.isPending ? (
        <p className="text-stone-700">Đang tải…</p>
      ) : list.data && list.data.items.length === 0 ? (
        <p className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700">
          Không có khoản nào cần đối soát.
        </p>
      ) : (
        list.data && (
          <ul className="space-y-4">
            {list.data.items.map((item) => {
              const statusDisplay = item.bookingStatus
                ? (BOOKING_STATUS_DISPLAY[
                    item.bookingStatus as keyof typeof BOOKING_STATUS_DISPLAY
                  ] ?? { label: item.bookingStatus, tone: 'neutral' as const })
                : undefined
              const resolving = reconcile.isPending && reconcile.variables?.id === item.id
              return (
                <li
                  key={item.id}
                  className="space-y-4 rounded-lg border border-stone-300 bg-white p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tracking-wide text-pearl-900">
                          {item.bookingCode ?? '—'}
                        </span>
                        {statusDisplay && (
                          <Badge tone={statusDisplay.tone}>{statusDisplay.label}</Badge>
                        )}
                      </div>
                      <p className="text-xs break-all text-stone-500">
                        Mã GD {item.transactionRef}
                        {item.providerTransactionRef
                          ? ` · VNPay ${item.providerTransactionRef}`
                          : ''}
                      </p>
                      <p className="text-xs text-stone-500">
                        {item.paidAt ? `Tiền về ${formatDateTime(item.paidAt)}` : ''}
                      </p>
                      <Link
                        to={`/booking/${item.bookingId}`}
                        className="text-xs font-semibold text-primary underline"
                      >
                        Xem booking
                      </Link>
                    </div>
                    <p className="text-lg font-semibold whitespace-nowrap text-primary tabular-nums">
                      {money.format(item.amount)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <TextField
                      label="Ghi chú đối soát"
                      placeholder="VD: đã hoàn tiền qua cổng VNPay"
                      maxLength={500}
                      value={notes[item.id] ?? ''}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                      className="flex-1"
                    />
                    <Button loading={resolving} onClick={() => void resolve(item.id)}>
                      Đánh dấu đã xử lý
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      )}
    </section>
  )
}
