import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Clock } from 'lucide-react'
import { AssetImage } from '@/components/AssetImage'
import { Button, Checkbox, Input } from '@/components/atoms'
import { FormField, KeyValue } from '@/components/molecules'
import { Panel } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'
import { fdate, vnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { HeldBooking, ServiceSelectionInput } from '../api'
import { useHoldBooking, useServiceCatalog, useSubmitBookingDetails } from '../hooks'
import { nightsBetween } from '../utils'
import { formatRemaining, useHoldCountdown } from './useHoldCountdown'

/**
 * UC07/UC46 — Create Booking. Giữ phòng NGAY khi vào trang (trước khi nhập form), rồi khách
 * điền thông tin liên hệ để chuyển ROOM_HELD → PENDING_DEPOSIT. Tạm tính, tiền cọc và hạn
 * giữ phòng đều lấy từ phản hồi của backend (không tự tính ở client).
 */
export function CreateBookingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { me } = useAuth()

  const checkIn = params.get('checkIn') ?? ''
  const checkOut = params.get('checkOut') ?? ''
  const guests = Number(params.get('guests') ?? '0')
  const roomsParam = params.get('rooms') ?? ''
  const rooms = roomsParam.split(',').filter(Boolean)
  const nights = nightsBetween(checkIn, checkOut)
  const invalid = rooms.length === 0 || nights <= 0 || guests < 1

  const hold = useHoldBooking()
  const submit = useSubmitBookingDetails()
  const { mutate: holdMutate } = hold

  const [held, setHeld] = useState<HeldBooking | undefined>()
  const requested = useRef(false)

  const [guestName, setGuestName] = useState(me?.fullName ?? '')
  const [guestEmail, setGuestEmail] = useState(me?.email ?? '')
  const [guestPhone, setGuestPhone] = useState(me?.phone ?? '')

  // Dịch vụ chọn kèm (tuỳ chọn): serviceId -> số lượng.
  const catalog = useServiceCatalog()
  const [selectedServices, setSelectedServices] = useState<Record<string, number>>({})

  function toggleService(id: string, on: boolean) {
    setSelectedServices((current) => {
      const next = { ...current }
      if (on) next[id] = next[id] ?? 1
      else delete next[id]
      return next
    })
  }

  function setServiceQuantity(id: string, value: number) {
    setSelectedServices((current) => ({
      ...current,
      [id]: Math.max(1, Math.floor(value) || 1),
    }))
  }

  const serviceSelections: ServiceSelectionInput[] = Object.entries(selectedServices).map(
    ([serviceId, quantity]) => ({ serviceId, quantity }),
  )

  const servicesSubtotal = (catalog.data ?? []).reduce(
    (sum, svc) =>
      sum + (selectedServices[svc.id] ? (svc.unitPriceVND ?? 0) * selectedServices[svc.id] : 0),
    0,
  )

  useEffect(() => {
    if (invalid || requested.current) return
    requested.current = true
    holdMutate(
      {
        rooms: roomsParam.split(',').filter(Boolean),
        checkIn,
        checkOut,
        adultCount: Math.max(1, guests),
        childCount: 0,
      },
      { onSuccess: (data) => setHeld(data) },
    )
  }, [invalid, roomsParam, checkIn, checkOut, guests, holdMutate])

  const remaining = useHoldCountdown(held?.holdExpiresAt)
  const holdExpired = remaining !== null && remaining <= 0

  if (invalid) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="font-display text-4xl font-semibold">Thiếu thông tin đặt phòng</h1>
        <p className="mt-2 text-muted-foreground">Vui lòng chọn lại phòng và ngày ở.</p>
        <div className="mt-6">
          <Button asChild className="rounded-full">
            <Link to="/search">Quay lại tìm phòng</Link>
          </Button>
        </div>
      </div>
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!held) return
    try {
      const updated = await submit.mutateAsync({
        holdToken: held.holdToken,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        ...(serviceSelections.length ? { serviceSelections } : {}),
      })
      navigate(`/booking/${updated.bookingId}`, { replace: true })
    } catch {
      // Lỗi hiển thị qua submit.isError bên dưới.
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
          <h1 className="font-display text-4xl font-semibold">Xác nhận & thông tin liên hệ</h1>
        </div>
        {remaining !== null && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
              holdExpired ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
            )}
          >
            <Clock className="size-4" />
            <span>
              {holdExpired ? 'Hết hạn giữ phòng' : `Giữ phòng còn ${formatRemaining(remaining)}`}
            </span>
          </div>
        )}
      </div>

      {hold.isPending && (
        <div role="status" className="py-8">
          <p className="text-muted-foreground">Đang giữ phòng cho bạn…</p>
        </div>
      )}

      {hold.isError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
        >
          {getErrorMessage(
            hold.error,
            'Không giữ được phòng (có thể vừa có người đặt hoặc bạn thao tác quá nhanh). Vui lòng tìm phòng lại.',
          )}
          <div className="mt-3">
            <Link to="/search" className="text-sm font-semibold underline">
              ← Tìm phòng lại
            </Link>
          </div>
        </div>
      )}

      {held && (
        <form onSubmit={onSubmit} className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px]">
          {/* Cột trái: form thông tin khách */}
          <div className="space-y-6">
            {holdExpired ? (
              <div
                role="alert"
                className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
              >
                Đã quá thời gian giữ phòng. Phòng có thể đã được mở lại cho khách khác — vui lòng
                tìm phòng lại.
              </div>
            ) : (
              remaining !== null && (
                <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-foreground">
                  <Clock className="size-4 shrink-0 text-primary" />
                  <span>
                    Phòng đang được giữ. Vui lòng hoàn tất trong{' '}
                    <strong>{formatRemaining(remaining)}</strong>, nếu không phòng sẽ được mở lại.
                  </span>
                </div>
              )
            )}

            <Panel title="Thông tin liên hệ">
              {me && (
                <p className="mb-4 text-sm text-muted-foreground">
                  Đặt với tài khoản {me.email}. Bạn có thể sửa tên và số điện thoại nếu cần.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Họ tên" htmlFor="guestName" required>
                  <Input
                    id="guestName"
                    required
                    maxLength={120}
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </FormField>
                <FormField label="Email" htmlFor="guestEmail" required>
                  <Input
                    id="guestEmail"
                    type="email"
                    required
                    maxLength={160}
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                  />
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="Số điện thoại" htmlFor="guestPhone" required>
                    <Input
                      id="guestPhone"
                      type="tel"
                      required
                      placeholder="0900000000"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Chúng tôi gửi mã đặt phòng (vé) tới email này để bạn thanh toán và quản lý đơn.
              </p>
            </Panel>

            {catalog.data && catalog.data.length > 0 && (
              <Panel title="Dịch vụ thêm (tuỳ chọn)">
                <p className="mb-4 text-sm text-muted-foreground">
                  Chọn trước, hệ thống tạo yêu cầu dịch vụ khi đặt phòng được xác nhận. Phí dịch vụ
                  thanh toán trong thời gian lưu trú.
                </p>
                <ul className="divide-y divide-border">
                  {catalog.data.map((svc) => {
                    const on = svc.id in selectedServices
                    return (
                      <li
                        key={svc.id}
                        className="flex flex-wrap items-center justify-between gap-4 py-3"
                      >
                        <label className="flex cursor-pointer items-center gap-3 text-sm">
                          <Checkbox
                            checked={on}
                            onCheckedChange={(checked) => toggleService(svc.id, Boolean(checked))}
                          />
                          <AssetImage decorative path={svc.imageUrl} name={svc.name} />
                          <div>
                            <span className="font-medium text-foreground">{svc.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {svc.unitPriceVND
                                ? `${vnd(svc.unitPriceVND)} / ${svc.unit || 'lần'}`
                                : 'Miễn phí'}
                            </span>
                          </div>
                        </label>
                        {on && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">SL:</span>
                            <Input
                              type="number"
                              min={1}
                              aria-label={`Số lượng ${svc.name}`}
                              value={selectedServices[svc.id]}
                              onChange={(e) => setServiceQuantity(svc.id, Number(e.target.value))}
                              className="h-9 w-20 text-center text-sm"
                            />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            )}

            {submit.isError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
              >
                {getErrorMessage(submit.error)}
              </div>
            )}

            <Link
              to="/search"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
            >
              ← Chọn lại phòng
            </Link>
          </div>

          {/* Cột phải: tóm tắt đặt phòng */}
          <aside className="card-soft sticky top-24 h-fit space-y-5 p-6">
            <h2 className="font-display text-2xl font-semibold">Tóm tắt đặt phòng</h2>

            <div className="divide-y divide-border border-y border-border">
              <KeyValue k="Nhận phòng" v={fdate(held.checkIn)} />
              <KeyValue k="Trả phòng" v={fdate(held.checkOut)} />
              <KeyValue k="Số đêm" v={`${nightsBetween(held.checkIn, held.checkOut)} đêm`} />
              <KeyValue
                k="Phòng · Khách"
                v={`${held.rooms.length} phòng · ${held.adultCount + held.childCount} khách`}
              />
            </div>

            <div className="divide-y divide-border border-b border-border pb-4">
              <KeyValue
                k="Tiền phòng"
                v={<span className="tabular-nums">{vnd(held.roomTotal)}</span>}
              />
              {servicesSubtotal > 0 && (
                <KeyValue
                  k="Dịch vụ thêm (trả khi lưu trú)"
                  v={<span className="tabular-nums">{vnd(servicesSubtotal)}</span>}
                />
              )}
              <div className="flex items-center justify-between gap-4 pt-3">
                <span className="font-semibold text-foreground">Cọc cần trả</span>
                <span className="text-xl font-bold text-primary tabular-nums">
                  {vnd(held.depositAmount)}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Số tiền do hệ thống xác nhận tại thời điểm giữ phòng. Bạn chưa bị trừ tiền ở bước này.
            </p>

            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={holdExpired || submit.isPending}
              aria-busy={submit.isPending}
            >
              {submit.isPending ? 'Đang chuyển sang thanh toán…' : 'Tiếp tục đặt cọc'}
            </Button>
          </aside>
        </form>
      )}
    </div>
  )
}
