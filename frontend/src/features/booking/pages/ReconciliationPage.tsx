import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Input, StatusBadge } from '@/components/atoms'
import { EmptyState, FormField } from '@/components/molecules'
import { getErrorMessage } from '@/lib/api-client'
import { vnd } from '@/lib/format'
import { useReconcilePayment, useReconciliationList } from '../hooks'
import { formatDateTime } from '../utils'

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
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-10 lg:px-8">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">Quản lý</p>
        <h1 className="font-display text-4xl font-semibold">Đối soát thanh toán</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Tiền đã về nhưng phòng không còn được giữ (thanh toán về sau thời hạn). Hãy hoàn tiền cho
          khách qua cổng VNPay rồi đánh dấu đã xử lý tại đây.
        </p>
      </div>

      {reconcile.isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
        >
          {getErrorMessage(reconcile.error)}
        </div>
      )}
      {list.isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
        >
          {getErrorMessage(list.error, 'Không tải được danh sách.')}
        </div>
      )}

      {list.isPending ? (
        <div role="status" className="py-8">
          <p className="text-muted-foreground">Đang tải…</p>
        </div>
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState
          title="Không có khoản nào cần đối soát"
          body="Mọi khoản thanh toán đều đã khớp sao kê."
        />
      ) : (
        list.data && (
          <ul className="space-y-4">
            {list.data.items.map((item) => {
              const resolving = reconcile.isPending && reconcile.variables?.id === item.id
              return (
                <li key={item.id} className="card-soft space-y-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tracking-wide text-foreground">
                          {item.bookingCode ?? '—'}
                        </span>
                        {item.bookingStatus && <StatusBadge status={item.bookingStatus} />}
                      </div>
                      <p className="text-xs break-all text-muted-foreground">
                        Mã GD {item.transactionRef}
                        {item.providerTransactionRef
                          ? ` · VNPay ${item.providerTransactionRef}`
                          : ''}
                      </p>
                      {item.paidAt && (
                        <p className="text-xs text-muted-foreground">
                          Tiền về {formatDateTime(item.paidAt)}
                        </p>
                      )}
                      <Link
                        to={
                          item.bookingCode
                            ? `/reception/bookings/${encodeURIComponent(item.bookingCode)}`
                            : `/booking/${item.bookingId}`
                        }
                        className="inline-block text-xs font-semibold text-primary underline underline-offset-4"
                      >
                        Xem booking
                      </Link>
                    </div>
                    <p className="text-lg font-semibold whitespace-nowrap text-primary tabular-nums">
                      {vnd(item.amount)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="sm:flex-1">
                      <FormField label="Ghi chú đối soát" htmlFor={`note-${item.id}`}>
                        <Input
                          id={`note-${item.id}`}
                          placeholder="VD: đã hoàn tiền qua cổng VNPay"
                          maxLength={500}
                          value={notes[item.id] ?? ''}
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [item.id]: event.target.value }))
                          }
                        />
                      </FormField>
                    </div>
                    <Button
                      className="rounded-full"
                      disabled={resolving}
                      aria-busy={resolving}
                      onClick={() => void resolve(item.id)}
                    >
                      {resolving ? 'Đang xử lý…' : 'Đánh dấu đã xử lý'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      )}
    </div>
  )
}
