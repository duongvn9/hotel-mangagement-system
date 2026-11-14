import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button, Input, NativeSelect, StatusBadge } from '@/components/atoms'
import { Alert, FormField, KeyValue } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { getErrorMessage, getErrorMessages } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  DESK_DEPOSIT_LABEL,
  type CreateWalkInBookingInput,
  type DeskDepositMethod,
  type WalkInBooking,
} from '../api'
import {
  useAvailability,
  useCreateWalkInBooking,
  useInitiateDeposit,
  useRecordDeskDeposit,
} from '../hooks'
import {
  INVALID_INPUT_CLASS,
  mapGuestServerErrors,
  validateGuestContact,
  type GuestFieldErrors,
} from '../guest-validation'
import { rememberPaymentRef } from '../storage'
import {
  daysFromTodayISO,
  formatDate,
  money,
  newRequestId,
  nightsBetween,
  todayISO,
} from '../utils'

/** Cách khách đóng cọc tại quầy: tiền mặt hoặc thẻ ghi ngay, hoặc VNPay mở trang thanh toán. */
type WalkInDepositMethod = DeskDepositMethod | 'VNPAY'

/** id ô nhập theo từng trường, để focus vào ô lỗi đầu tiên. */
const FIELD_IDS: Record<keyof GuestFieldErrors, string> = {
  guestName: 'walkin-guest-name',
  guestEmail: 'walkin-guest-email',
  guestPhone: 'walkin-guest-phone',
}

/** UC08 — Create Booking for Guest. Lễ tân chọn phòng trống rồi đặt hộ khách vãng lai, vào thẳng CONFIRMED. */
export function WalkInBookingPage() {
  // Từ trang tìm khách (UC14): điền sẵn thông tin khách cũ, lễ tân vẫn sửa được.
  const [params] = useSearchParams()
  const [checkIn, setCheckIn] = useState(() => params.get('checkIn') || todayISO())
  const [checkOut, setCheckOut] = useState(() => params.get('checkOut') || daysFromTodayISO(2))
  const [adultCount, setAdultCount] = useState('2')
  const [childCount, setChildCount] = useState('0')
  const [formError, setFormError] = useState('')
  const [criteria, setCriteria] = useState<Pick<
    CreateWalkInBookingInput,
    'checkIn' | 'checkOut' | 'adultCount' | 'childCount'
  > | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  const [guestName, setGuestName] = useState(params.get('guestName') ?? '')
  const [guestEmail, setGuestEmail] = useState(params.get('guestEmail') ?? '')
  const [guestPhone, setGuestPhone] = useState(params.get('guestPhone') ?? '')
  // Lỗi theo từng trường thông tin khách (client kiểm trước, server map sau), hiện ngay dưới ô nhập.
  const [contactErrors, setContactErrors] = useState<GuestFieldErrors>({})
  // Lỗi tạo booking không thuộc trường nào (vd phòng vừa bị giữ) để hiện ở thông báo chung.
  const [submitBanner, setSubmitBanner] = useState('')
  const [created, setCreated] = useState<WalkInBooking | null>(null)

  function clearContactError(field: keyof GuestFieldErrors) {
    setContactErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }
  const [depositMethod, setDepositMethod] = useState<WalkInDepositMethod | ''>('')
  // Giữ nguyên mã khi thu cọc lỗi để bấm lại không ghi trùng.
  const [depositRequestId, setDepositRequestId] = useState(newRequestId)

  const availability = useAvailability(
    criteria
      ? {
          checkIn: criteria.checkIn,
          checkOut: criteria.checkOut,
          guests: criteria.adultCount + criteria.childCount,
        }
      : null,
  )
  const create = useCreateWalkInBooking()
  const deposit = useRecordDeskDeposit()
  const vnpay = useInitiateDeposit()
  const nights = criteria ? nightsBetween(criteria.checkIn, criteria.checkOut) : 0

  // Đánh số phòng theo thứ tự trong từng loại (kết quả tìm phòng không trả số phòng).
  const rooms = useMemo(() => {
    const countByType = new Map<string, number>()
    return (availability.data ?? []).map((room) => {
      const index = (countByType.get(room.roomTypeId) ?? 0) + 1
      countByType.set(room.roomTypeId, index)
      return { ...room, label: `${room.roomTypeName ?? 'Phòng'} · Phòng ${index}` }
    })
  }, [availability.data])

  const estimatedTotal = rooms
    .filter((room) => selected.includes(room.id))
    .reduce((sum, room) => sum + (room.pricePerNight ?? 0) * nights, 0)

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    if (nightsBetween(checkIn, checkOut) <= 0) {
      setFormError('Ngày trả phòng phải sau ngày nhận phòng.')
      return
    }
    const adults = Number(adultCount)
    const children = Number(childCount)
    if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0) {
      setFormError('Cần ít nhất 1 người lớn và số trẻ em không âm.')
      return
    }
    setSelected([])
    create.reset()
    setCriteria({ checkIn, checkOut, adultCount: adults, childCount: children })
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  async function submitBooking(event: FormEvent) {
    event.preventDefault()
    if (!criteria || selected.length === 0 || !depositMethod) return

    // Kiểm tra thông tin khách phía client: lỗi hiện ngay dưới đúng ô nhập, bằng tiếng Việt.
    const clientErrors = validateGuestContact({ guestName, guestEmail, guestPhone })
    setSubmitBanner('')
    if (Object.keys(clientErrors).length > 0) {
      setContactErrors(clientErrors)
      const firstField = (['guestName', 'guestEmail', 'guestPhone'] as const).find(
        (field) => clientErrors[field],
      )
      if (firstField) document.getElementById(FIELD_IDS[firstField])?.focus()
      return
    }
    setContactErrors({})

    try {
      const booking = await create.mutateAsync({
        rooms: selected,
        ...criteria,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
      })
      setCreated(booking)
      await takeDeposit(booking.id, depositMethod)
    } catch (error) {
      // Server vẫn báo lỗi: đưa lỗi validate về đúng ô, phần còn lại hiện ở thông báo chung.
      const { fieldErrors, rest } = mapGuestServerErrors(getErrorMessages(error))
      setContactErrors(fieldErrors)
      setSubmitBanner(
        rest.join(', ') || (Object.keys(fieldErrors).length ? '' : getErrorMessage(error)),
      )
      const firstField = (['guestName', 'guestEmail', 'guestPhone'] as const).find(
        (field) => fieldErrors[field],
      )
      if (firstField) document.getElementById(FIELD_IDS[firstField])?.focus()
    }
  }

  /**
   * Thu cọc cho booking vừa tạo. Tiền mặt/thẻ ghi ngay khoản khách vừa đóng (lỗi giữ booking và cho
   * thu lại bằng cùng mã); VNPay mở trang thanh toán, cọc được ghi nhận khi VNPay xác nhận.
   */
  async function takeDeposit(id: string, method: WalkInDepositMethod) {
    try {
      if (method === 'VNPAY') {
        const result = await vnpay.mutateAsync({ bookingId: id })
        // Nhớ giao dịch thuộc booking nào để trang kết quả VNPay cập nhật đúng.
        rememberPaymentRef(result.transactionRef, id)
        window.open(result.paymentUrl, '_blank', 'noopener')
      } else {
        await deposit.mutateAsync({ id, method, requestId: depositRequestId })
      }
    } catch {
      // Lỗi hiển thị qua deposit.isError / vnpay.isError ở trang kết quả.
    }
  }

  function startOver() {
    setCreated(null)
    setCriteria(null)
    setSelected([])
    setGuestName('')
    setGuestEmail('')
    setGuestPhone('')
    setContactErrors({})
    setSubmitBanner('')
    setDepositMethod('')
    setDepositRequestId(newRequestId())
    create.reset()
    deposit.reset()
    vnpay.reset()
  }

  if (created) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          eyebrow="Lễ tân"
          title="Đã tạo booking"
          subtitle="Booking đã xác nhận, phòng đã được giữ cho khách."
        />
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <Panel title="Booking">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div>
                <p className="text-sm text-muted-foreground">Mã booking</p>
                <p className="text-2xl font-semibold tracking-wide text-primary tabular-nums">
                  {created.code}
                </p>
              </div>
              <StatusBadge status={created.status} />
            </div>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <KeyValue k="Nhận phòng" v={formatDate(created.checkIn)} />
              <KeyValue k="Trả phòng" v={formatDate(created.checkOut)} />
              <KeyValue
                k="Số khách"
                v={`${created.adultCount} người lớn · ${created.childCount} trẻ em`}
              />
            </div>
          </Panel>

          <Panel title="Thanh toán">
            <div className="divide-y">
              <KeyValue
                k="Tiền phòng"
                v={<span className="tabular-nums">{money.format(created.roomTotal)}</span>}
              />
              <KeyValue
                k="Tiền cọc"
                v={<span className="tabular-nums">{money.format(created.depositAmount)}</span>}
              />
            </div>
            <div className="mt-4 space-y-3">
              {depositMethod === 'VNPAY' ? (
                <>
                  {vnpay.isPending && (
                    <p className="text-sm text-muted-foreground">Đang mở cổng VNPay…</p>
                  )}
                  {vnpay.isSuccess && (
                    <Alert tone="info">
                      <p className="mb-3">
                        Đã mở trang VNPay để khách thanh toán cọc. Cọc được ghi nhận khi VNPay xác
                        nhận; xem trạng thái ở trang chi tiết booking.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="secondary" size="sm" className="rounded-full">
                          <Link to={`/reception/bookings/${encodeURIComponent(created.code)}`}>
                            Xem booking
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          disabled={vnpay.isPending}
                          onClick={() => void takeDeposit(created.id, 'VNPAY')}
                        >
                          Mở lại trang VNPay
                        </Button>
                      </div>
                    </Alert>
                  )}
                  {vnpay.isError && (
                    <Alert tone="danger">
                      <p className="mb-3">
                        Đã tạo booking nhưng chưa mở được VNPay: {getErrorMessage(vnpay.error)}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void takeDeposit(created.id, 'VNPAY')}
                      >
                        Mở lại trang VNPay
                      </Button>
                    </Alert>
                  )}
                </>
              ) : (
                <>
                  {deposit.isPending && (
                    <p className="text-sm text-muted-foreground">Đang ghi nhận tiền cọc…</p>
                  )}
                  {deposit.isSuccess && depositMethod && (
                    <Alert tone="success">
                      Đã thu cọc {money.format(created.depositAmount)} bằng{' '}
                      {DESK_DEPOSIT_LABEL[depositMethod]}.
                    </Alert>
                  )}
                  {deposit.isError && depositMethod && (
                    <Alert tone="danger">
                      <p className="mb-3">
                        Đã tạo booking nhưng chưa thu được cọc: {getErrorMessage(deposit.error)}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void takeDeposit(created.id, depositMethod)}
                      >
                        Thu cọc lại
                      </Button>
                    </Alert>
                  )}
                </>
              )}
            </div>
          </Panel>
        </div>
        <Button onClick={startOver} className="rounded-full">
          Tạo booking khác
        </Button>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Lễ tân"
        title="Tạo booking cho khách vãng lai"
        subtitle="Booking tại quầy được xác nhận ngay; khách đóng cọc bằng tiền mặt, thẻ hoặc VNPay."
      />

      <form
        onSubmit={submitSearch}
        className="card-soft grid gap-4 p-5 sm:p-6 md:grid-cols-5"
        aria-label="Tìm phòng trống"
      >
        <FormField label="Nhận phòng" htmlFor="walkin-check-in" required>
          <Input
            id="walkin-check-in"
            type="date"
            required
            min={todayISO()}
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
          />
        </FormField>
        <FormField label="Trả phòng" htmlFor="walkin-check-out" required>
          <Input
            id="walkin-check-out"
            type="date"
            required
            min={checkIn || todayISO()}
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
          />
        </FormField>
        <FormField label="Người lớn" htmlFor="walkin-adult-count" required>
          <Input
            id="walkin-adult-count"
            type="number"
            required
            min={1}
            step={1}
            value={adultCount}
            onChange={(event) => setAdultCount(event.target.value)}
          />
        </FormField>
        <FormField label="Trẻ em" htmlFor="walkin-child-count" required>
          <Input
            id="walkin-child-count"
            type="number"
            required
            min={0}
            step={1}
            value={childCount}
            onChange={(event) => setChildCount(event.target.value)}
          />
        </FormField>
        <div className="flex items-end">
          <Button type="submit" className="w-full rounded-full" disabled={availability.isFetching}>
            Tìm phòng trống
          </Button>
        </div>
        {formError && (
          <div className="md:col-span-5">
            <Alert tone="danger">{formError}</Alert>
          </div>
        )}
      </form>

      {availability.isError && <Alert tone="danger">{getErrorMessage(availability.error)}</Alert>}

      {criteria && availability.isSuccess && (
        <form
          noValidate
          onSubmit={submitBooking}
          className="grid items-start gap-6 lg:grid-cols-[1fr_360px]"
        >
          <div className="space-y-5">
            <Panel title={`Chọn phòng (${nights} đêm · ${rooms.length} phòng trống)`}>
              {rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Không còn phòng phù hợp trong khoảng ngày này.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {rooms.map((room) => {
                    const isSelected = selected.includes(room.id)
                    return (
                      <li key={room.id}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-sm transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-card hover:border-primary/50 text-foreground',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(room.id)}
                            aria-label={room.label}
                            className="size-4 cursor-pointer rounded accent-primary"
                          />
                          <span className="flex-1 font-medium">{room.label}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {money.format(room.pricePerNight ?? 0)}/đêm
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Thông tin khách">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Họ tên"
                  htmlFor="walkin-guest-name"
                  required
                  error={contactErrors.guestName}
                >
                  <Input
                    id="walkin-guest-name"
                    required
                    maxLength={120}
                    aria-invalid={Boolean(contactErrors.guestName)}
                    className={cn(contactErrors.guestName && INVALID_INPUT_CLASS)}
                    value={guestName}
                    onChange={(event) => {
                      setGuestName(event.target.value)
                      clearContactError('guestName')
                    }}
                  />
                </FormField>
                <FormField
                  label="Email"
                  htmlFor="walkin-guest-email"
                  required
                  error={contactErrors.guestEmail}
                >
                  <Input
                    id="walkin-guest-email"
                    type="email"
                    required
                    maxLength={160}
                    aria-invalid={Boolean(contactErrors.guestEmail)}
                    className={cn(contactErrors.guestEmail && INVALID_INPUT_CLASS)}
                    value={guestEmail}
                    onChange={(event) => {
                      setGuestEmail(event.target.value)
                      clearContactError('guestEmail')
                    }}
                  />
                </FormField>
                <FormField
                  label="Số điện thoại"
                  htmlFor="walkin-guest-phone"
                  required
                  className="sm:col-span-2"
                  error={contactErrors.guestPhone}
                >
                  <Input
                    id="walkin-guest-phone"
                    type="tel"
                    required
                    placeholder="0900000000"
                    aria-invalid={Boolean(contactErrors.guestPhone)}
                    className={cn(contactErrors.guestPhone && INVALID_INPUT_CLASS)}
                    value={guestPhone}
                    onChange={(event) => {
                      setGuestPhone(event.target.value)
                      clearContactError('guestPhone')
                    }}
                  />
                </FormField>
              </div>
            </Panel>

            <Panel title="Thu cọc">
              <FormField label="Hình thức thu cọc" htmlFor="walkin-deposit-method" required>
                <NativeSelect
                  id="walkin-deposit-method"
                  required
                  value={depositMethod}
                  onChange={(event) =>
                    setDepositMethod(event.target.value as WalkInDepositMethod | '')
                  }
                >
                  <option value="">Chọn hình thức</option>
                  <option value="CASH">Tiền mặt</option>
                  <option value="CARD">Thẻ</option>
                  <option value="VNPAY">VNPay</option>
                </NativeSelect>
              </FormField>
              <p className="mt-2 text-xs text-muted-foreground">
                Tiền mặt và thẻ được ghi nhận ngay; VNPay mở trang thanh toán cho khách. Số tiền cọc
                do hệ thống tính khi tạo booking.
              </p>
            </Panel>

            {submitBanner && <Alert tone="danger">{submitBanner}</Alert>}
          </div>

          <aside className="card-soft h-fit space-y-4 p-6 lg:sticky lg:top-6">
            <h2 className="font-display text-xl font-semibold text-foreground">Tóm tắt</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Phòng đã chọn</dt>
                <dd className="font-semibold text-foreground">{selected.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Tạm tính tiền phòng</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {money.format(estimatedTotal)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Tổng tiền chính thức do hệ thống tính khi tạo booking.
            </p>
            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={selected.length === 0 || !depositMethod || create.isPending}
            >
              Tạo booking
            </Button>
          </aside>
        </form>
      )}
    </PageContainer>
  )
}
