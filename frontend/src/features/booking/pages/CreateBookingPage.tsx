import { AssetImage } from '@/components/AssetImage'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { useAuth } from '@/features/auth/auth-context'
import type { HeldBooking, ServiceSelectionInput } from '../api'
import { useHoldBooking, useServiceCatalog, useSubmitBookingDetails } from '../hooks'
import { MoonIcon } from '../icons'
import { formatDate, money, nightsBetween } from '../utils'
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
  const { mutate: holdMutate } = hold // react-query mutate ổn định giữa các render

  const [held, setHeld] = useState<HeldBooking | undefined>()
  const requested = useRef(false)

  const [guestName, setGuestName] = useState(me?.fullName ?? '')
  const [guestEmail, setGuestEmail] = useState(me?.email ?? '')
  const [guestPhone, setGuestPhone] = useState(me?.phone ?? '')

  // Dịch vụ chọn kèm (tuỳ chọn): serviceId -> số lượng. Hệ thống tự tạo yêu cầu dịch vụ
  // khi booking được xác nhận (qua CONFIRMED).
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

  // Giữ phòng một lần khi vào trang (trước khi nhập form). Backend chỉ cho 1 hold/phiên nên
  // bấm lại/refresh trả đúng hold cũ qua cookie phiên — không tạo thêm và không gia hạn.
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
      <section className="mx-auto max-w-container space-y-4 px-4 py-16 text-center font-body">
        <h1 className="font-display text-3xl font-semibold text-pearl-900">
          Thiếu thông tin đặt phòng
        </h1>
        <p className="text-stone-700">Vui lòng chọn lại phòng và ngày ở.</p>
        <Link to="/search" className="text-primary underline">
          Quay lại tìm phòng
        </Link>
      </section>
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
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">
          Xác nhận & thông tin liên hệ
        </h1>
      </div>

      {hold.isPending && <p role="status">Đang giữ phòng cho bạn…</p>}

      {hold.isError && (
        <Alert tone="danger">
          {getErrorMessage(
            hold.error,
            'Không giữ được phòng (có thể vừa có người đặt hoặc bạn thao tác quá nhanh). Vui lòng tìm phòng lại.',
          )}
          <div className="mt-3">
            <Link to="/search" className="text-sm font-semibold text-primary underline">
              ← Tìm phòng lại
            </Link>
          </div>
        </Alert>
      )}

      {held && (
        <form onSubmit={onSubmit} className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          {/* Cột trái: thông tin khách */}
          <div className="space-y-5">
            {holdExpired ? (
              <Alert tone="danger">
                Đã quá thời gian giữ phòng. Phòng có thể đã được mở lại cho khách khác — vui lòng
                tìm phòng lại.
              </Alert>
            ) : (
              remaining !== null && (
                <Alert tone="warning">
                  Phòng đang được giữ. Vui lòng hoàn tất trong{' '}
                  <strong>{formatRemaining(remaining)}</strong>, nếu không phòng sẽ được mở lại.
                </Alert>
              )
            )}

            <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-6">
              <h2 className="font-display text-xl font-semibold text-pearl-900">
                Thông tin liên hệ
              </h2>
              {me && (
                <p className="text-sm text-stone-700">
                  Đặt với tài khoản {me.email}. Bạn có thể sửa tên và số điện thoại nếu cần.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Họ tên"
                  required
                  maxLength={120}
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                />
                <TextField
                  label="Email"
                  type="email"
                  required
                  maxLength={160}
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                />
                <TextField
                  label="Số điện thoại"
                  type="tel"
                  required
                  placeholder="0900000000"
                  value={guestPhone}
                  onChange={(event) => setGuestPhone(event.target.value)}
                  className="sm:col-span-2"
                />
              </div>
              <p className="text-xs text-stone-700">
                Chúng tôi gửi mã đặt phòng (vé) tới email/số điện thoại này để bạn thanh toán và
                quản lý đơn.
              </p>
            </div>

            {catalog.data && catalog.data.length > 0 && (
              <div className="space-y-4 rounded-xl border border-stone-300 bg-white p-6">
                <h2 className="font-display text-xl font-semibold text-pearl-900">
                  Dịch vụ thêm (tuỳ chọn)
                </h2>
                <p className="text-sm text-stone-700">
                  Chọn trước, hệ thống tạo yêu cầu dịch vụ khi đặt phòng được xác nhận. Phí dịch vụ
                  thanh toán trong thời gian lưu trú.
                </p>
                <ul className="space-y-3">
                  {catalog.data.map((svc) => {
                    const on = svc.id in selectedServices
                    return (
                      <li
                        key={svc.id}
                        className="flex flex-wrap items-center justify-between gap-3"
                      >
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(event) => toggleService(svc.id, event.target.checked)}
                          />
                          <AssetImage decorative path={svc.imageUrl} name={svc.name} />
                          <span className="font-semibold text-pearl-900">{svc.name}</span>
                          <span className="text-stone-700">
                            {svc.unitPriceVND
                              ? `${money.format(svc.unitPriceVND)}/${svc.unit || 'lần'}`
                              : 'Miễn phí'}
                          </span>
                        </label>
                        {on && (
                          <input
                            type="number"
                            min={1}
                            aria-label={`Số lượng ${svc.name}`}
                            value={selectedServices[svc.id]}
                            onChange={(event) =>
                              setServiceQuantity(svc.id, Number(event.target.value))
                            }
                            className="h-10 w-20 rounded border border-stone-300 px-2"
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {submit.isError && <Alert tone="danger">{getErrorMessage(submit.error)}</Alert>}

            <Link
              to="/search"
              className="inline-flex h-11 items-center text-sm font-semibold tracking-wider text-stone-700 uppercase hover:text-primary"
            >
              ← Chọn lại phòng
            </Link>
          </div>

          {/* Cột phải: tóm tắt đặt phòng (server-authoritative) */}
          <aside className="h-fit space-y-4 rounded-xl border border-stone-300 bg-cream-50 p-6 lg:sticky lg:top-6">
            <h2 className="font-display text-xl font-semibold text-pearl-900">Tóm tắt đặt phòng</h2>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-stone-700">Nhận phòng</dt>
                <dd className="font-semibold">{formatDate(held.checkIn)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-700">Trả phòng</dt>
                <dd className="font-semibold">{formatDate(held.checkOut)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="inline-flex items-center gap-1.5 text-stone-700">
                  <MoonIcon className="size-4 text-primary" /> Số đêm
                </dt>
                <dd className="font-semibold">{nightsBetween(held.checkIn, held.checkOut)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-700">Phòng · Khách</dt>
                <dd className="font-semibold">
                  {held.rooms.length} phòng · {held.adultCount + held.childCount} khách
                </dd>
              </div>
            </dl>

            <dl className="space-y-2 border-t border-stone-300 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-stone-700">Tiền phòng</dt>
                <dd className="font-semibold tabular-nums">{money.format(held.roomTotal)}</dd>
              </div>
              {servicesSubtotal > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-700">Dịch vụ thêm (trả khi lưu trú)</dt>
                  <dd className="font-semibold tabular-nums">{money.format(servicesSubtotal)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="font-semibold text-pearl-900">Cọc cần trả</dt>
                <dd className="font-display text-lg font-semibold text-primary tabular-nums">
                  {money.format(held.depositAmount)}
                </dd>
              </div>
            </dl>

            <p className="text-xs text-stone-700">
              Số tiền do hệ thống xác nhận tại thời điểm giữ phòng. Bạn chưa bị trừ tiền ở bước này.
            </p>

            <Button
              type="submit"
              className="w-full"
              loading={submit.isPending}
              disabled={holdExpired}
            >
              Tiếp tục đặt cọc
            </Button>
          </aside>
        </form>
      )}
    </section>
  )
}
