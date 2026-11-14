import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useBlocker, useNavigate, useSearchParams } from 'react-router'
import { Clock, CreditCard, Minus, Plus, XCircle } from 'lucide-react'
import { AssetImage } from '@/components/AssetImage'
import { Button, Checkbox, Input, Label, RadioGroup, RadioGroupItem } from '@/components/atoms'
import { Alert, FormField, KeyValue } from '@/components/molecules'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Panel,
} from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage, getErrorMessages } from '@/lib/api-client'
import { fdate, vnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  cancelBooking,
  getActiveBookingConflict,
  type ActiveBooking,
  type HeldBooking,
  type ServiceSelectionInput,
} from '../api'
import {
  useAvailability,
  useCancelBooking,
  useHoldBooking,
  useInitiateDeposit,
  useServiceCatalog,
  useSubmitBookingDetails,
  useUpdateHoldRooms,
} from '../hooks'
import { nightsBetween } from '../utils'
import {
  INVALID_INPUT_CLASS,
  mapGuestServerErrors,
  validateGuestContact,
  type GuestFieldErrors,
} from '../guest-validation'
import { rememberPaymentRef } from '../storage'
import { formatRemaining, useHoldCountdown } from './useHoldCountdown'

/**
 * UC07/UC46 — Create Booking. Giữ phòng NGAY khi vào trang (trước khi nhập form), rồi khách
 * điền thông tin liên hệ để chuyển ROOM_HELD → PENDING_DEPOSIT. Tạm tính, tiền cọc và hạn
 * giữ phòng đều lấy từ phản hồi của backend (không tự tính ở client).
 */
export function CreateBookingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { me, status } = useAuth()

  const checkIn = params.get('checkIn') ?? ''
  const checkOut = params.get('checkOut') ?? ''
  const guests = Number(params.get('guests') ?? '0')
  const roomsParam = params.get('rooms') ?? ''
  const rooms = roomsParam.split(',').filter(Boolean)
  const nights = nightsBetween(checkIn, checkOut)
  const invalid = rooms.length === 0 || nights <= 0 || guests < 1

  const hold = useHoldBooking()
  const submit = useSubmitBookingDetails()
  const deposit = useInitiateDeposit()
  const cancel = useCancelBooking()
  const { mutate: holdMutate } = hold

  const [held, setHeld] = useState<HeldBooking | undefined>()
  const [activeBooking, setActiveBooking] = useState<ActiveBooking>()
  const [activeResolved, setActiveResolved] = useState(false)
  const [holdAttempt, setHoldAttempt] = useState(0)
  const requested = useRef(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const cancellingRef = useRef(false)
  // Refs để cleanup lúc unmount đọc được giá trị mới nhất mà không phụ thuộc dependency.
  const heldRef = useRef<HeldBooking | undefined>(undefined)
  const submittedRef = useRef(false)
  const doneRef = useRef(false)
  const meRef = useRef(me)
  useEffect(() => {
    meRef.current = me
  }, [me])

  // Chỉnh số lượng phòng từng loại ngay trong trang đặt: lấy phòng trống để nới pool, chỉnh rồi
  // gọi cập nhật hold (không tạo hold mới nên không đụng rate-limit, không gia hạn giữ phòng).
  const availability = useAvailability(
    invalid ? null : { checkIn, checkOut, guests: Math.max(1, guests) },
  )
  const updateRooms = useUpdateHoldRooms()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [qtySig, setQtySig] = useState('')

  // Phòng trống theo loại (backend đã loại phòng đang giữ của phiên này).
  const freeByType = useMemo(() => {
    const map = new Map<string, { name: string; price: number; ids: string[] }>()
    const rooms = Array.isArray(availability.data) ? availability.data : []
    for (const room of rooms) {
      const group = map.get(room.roomTypeId) ?? {
        name: room.roomTypeName ?? 'Phòng',
        price: room.pricePerNight ?? 0,
        ids: [],
      }
      group.ids.push(room.id)
      map.set(room.roomTypeId, group)
    }
    return map
  }, [availability.data])

  // Gộp loại đang giữ + loại còn trống; pool mỗi loại = phòng đang giữ + phòng còn trống.
  const editorTypes = useMemo(() => {
    if (!held) return []
    const types = new Map<
      string,
      { roomTypeId: string; name: string; price: number; pool: string[] }
    >()
    for (const group of held.roomTypes) {
      types.set(group.roomTypeId, {
        roomTypeId: group.roomTypeId,
        name: group.roomTypeName,
        price: group.pricePerNight,
        pool: [...group.roomIds],
      })
    }
    for (const [id, group] of freeByType) {
      const existing = types.get(id)
      if (existing) existing.pool = [...new Set([...existing.pool, ...group.ids])]
      else {
        types.set(id, {
          roomTypeId: id,
          name: group.name,
          price: group.price,
          pool: [...group.ids],
        })
      }
    }
    return [...types.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [held, freeByType])

  // Đồng bộ số lượng đang chọn theo hold hiện tại, ngay trong render (reset khi hold đổi, ví dụ
  // sau khi cập nhật) — tránh setState trong effect gây render thừa.
  const heldSignature = held ? `${held.holdToken}:${held.rooms.join(',')}` : ''
  if (held && qtySig !== heldSignature) {
    setQtySig(heldSignature)
    const next: Record<string, number> = {}
    for (const group of held.roomTypes) next[group.roomTypeId] = group.roomIds.length
    setQty(next)
  }

  const nextRoomIds = useMemo(
    () => editorTypes.flatMap((type) => type.pool.slice(0, qty[type.roomTypeId] ?? 0)),
    [editorTypes, qty],
  )
  const roomsChanged =
    held != null &&
    !(
      nextRoomIds.length === held.rooms.length && nextRoomIds.every((id) => held.rooms.includes(id))
    )

  function changeRoomQty(roomTypeId: string, delta: number, max: number) {
    setQty((prev) => ({
      ...prev,
      [roomTypeId]: Math.max(0, Math.min(max, (prev[roomTypeId] ?? 0) + delta)),
    }))
  }

  async function applyRooms() {
    if (!held || !roomsChanged || nextRoomIds.length < 1) return
    try {
      const data = await updateRooms.mutateAsync({
        holdToken: held.holdToken,
        rooms: nextRoomIds,
      })
      setHeld(data)
      heldRef.current = data
    } catch {
      // Lỗi hiển thị qua updateRooms.isError (vd: phòng vừa bị giữ, hoặc ít hơn số khách).
    }
  }

  const [guestName, setGuestName] = useState(me?.fullName ?? '')
  const [guestEmail, setGuestEmail] = useState(me?.email ?? '')
  const [guestPhone, setGuestPhone] = useState(me?.phone ?? '')
  // Lỗi theo từng trường thông tin liên hệ (client kiểm trước, server map sau), hiển thị ngay dưới ô nhập.
  const [contactErrors, setContactErrors] = useState<GuestFieldErrors>({})
  // Lỗi submit không thuộc trường nào (vd hold hết hạn) để hiện ở thông báo chung.
  const [submitBanner, setSubmitBanner] = useState('')

  function clearContactError(field: keyof GuestFieldErrors) {
    setContactErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

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
    if (invalid || status === 'loading' || requested.current) return
    requested.current = true
    holdMutate(
      {
        rooms: roomsParam.split(',').filter(Boolean),
        checkIn,
        checkOut,
        adultCount: Math.max(1, guests),
        childCount: 0,
      },
      {
        onSuccess: (data) => {
          if (data.status === 'PENDING_DEPOSIT') {
            submittedRef.current = true
          }
          setActiveBooking(undefined)
          setActiveResolved(false)
          setHeld(data)
          heldRef.current = data
        },
        onError: (error) => {
          setActiveBooking(getActiveBookingConflict(error))
          setActiveResolved(false)
        },
      },
    )
  }, [invalid, status, roomsParam, checkIn, checkOut, guests, holdMutate, holdAttempt])

  function retryHold() {
    if (hold.isPending || cancellingRef.current) return
    requested.current = false
    setActiveBooking(undefined)
    setActiveResolved(false)
    setHoldAttempt((attempt) => attempt + 1)
  }

  async function cancelActiveBooking() {
    if (
      !activeBooking ||
      activeResolved ||
      Date.parse(activeBooking.holdExpiresAt) <= Date.now() ||
      cancellingRef.current
    )
      return
    cancellingRef.current = true
    try {
      await cancel.mutateAsync({
        id: activeBooking.id,
        ...(me ? {} : { code: activeBooking.code }),
      })
      setActiveResolved(true)
      setConfirmCancel(false)
    } catch {
      // Keep the confirmation open for a deliberate retry.
    } finally {
      cancellingRef.current = false
    }
  }

  // Warn on refresh for either active checkout step. Unmount only releases ROOM_HELD;
  // a pending deposit must never be cancelled merely because the page was left.
  useEffect(() => {
    // Còn đang giữ phòng, chưa đặt cọc và chưa chủ động huỷ, và hold vẫn còn hạn.
    const stillHolding = () => {
      const current = heldRef.current
      return Boolean(
        current &&
        !submittedRef.current &&
        !doneRef.current &&
        Date.parse(current.holdExpiresAt) > Date.now(),
      )
    }
    const warn = (event: BeforeUnloadEvent) => {
      const current = heldRef.current
      if (current && !doneRef.current && Date.parse(current.holdExpiresAt) > Date.now()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      const current = heldRef.current
      if (current && stillHolding()) {
        void cancelBooking(current.bookingId, meRef.current ? {} : { code: current.code }).catch(
          () => undefined,
        )
      }
    }
  }, [])

  const activeRemaining = useHoldCountdown(activeBooking?.holdExpiresAt)
  const activeExpired = activeRemaining !== null && activeRemaining <= 0
  const existingBookingTo = activeBooking
    ? me?.role === 'CUSTOMER'
      ? `/my-bookings/${encodeURIComponent(activeBooking.id)}`
      : me?.role === 'MANAGER' || me?.role === 'RECEPTIONIST'
        ? `/reception/bookings/${encodeURIComponent(activeBooking.code)}`
        : `/booking/${encodeURIComponent(activeBooking.id)}?code=${encodeURIComponent(activeBooking.code)}`
    : '/search'
  const remaining = useHoldCountdown(held?.holdExpiresAt)
  const holdExpired = remaining !== null && remaining <= 0

  // Warn before leaving either active checkout step. Only ROOM_HELD is released on leave;
  // PENDING_DEPOSIT stays available until explicit cancellation or backend expiry.
  const blocker = useBlocker(() => Boolean(held) && !doneRef.current && !holdExpired)

  async function confirmLeave() {
    if (heldRef.current?.status === 'PENDING_DEPOSIT') {
      doneRef.current = true
      blocker.proceed?.()
      return
    }
    doneRef.current = true
    const current = heldRef.current
    if (current) {
      try {
        await cancelBooking(current.bookingId, me ? {} : { code: current.code })
      } catch {
        // Vẫn rời trang; nếu huỷ lỗi thì hold tự hết hạn sau 15 phút.
      }
    }
    blocker.proceed?.()
  }

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
    if (!held || held.status !== 'ROOM_HELD' || holdExpired || submit.isPending) return

    // Kiểm tra phía client trước: lỗi hiện ngay dưới đúng ô nhập, bằng tiếng Việt.
    const clientErrors = validateGuestContact({ guestName, guestEmail, guestPhone })
    setSubmitBanner('')
    if (Object.keys(clientErrors).length > 0) {
      setContactErrors(clientErrors)
      const firstField = (['guestName', 'guestEmail', 'guestPhone'] as const).find(
        (field) => clientErrors[field],
      )
      if (firstField) document.getElementById(firstField)?.focus()
      return
    }
    setContactErrors({})

    try {
      const updated = await submit.mutateAsync({
        holdToken: held.holdToken,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        ...(serviceSelections.length ? { serviceSelections } : {}),
      })
      // Đã chuyển sang PENDING_DEPOSIT: không auto-huỷ hold khi rời trang nữa.
      submittedRef.current = true
      setHeld(updated)
      heldRef.current = updated
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
      if (firstField) document.getElementById(firstField)?.focus()
    }
  }

  async function payDeposit() {
    if (
      !held ||
      held.status !== 'PENDING_DEPOSIT' ||
      holdExpired ||
      deposit.isPending ||
      cancellingRef.current
    )
      return
    try {
      const result = await deposit.mutateAsync({
        bookingId: held.bookingId,
        ...(me ? {} : { code: held.code }),
      })
      rememberPaymentRef(result.transactionRef, held.bookingId)
      window.location.href = result.paymentUrl
    } catch {
      // Giữ bước thanh toán để thử lại mà không gửi lại thông tin liên hệ hoặc tạo hold mới.
    }
  }

  // Khách chủ động huỷ khi đang giữ phòng (ROOM_HELD): nhả hold + huỷ đơn, về trang tìm phòng.
  async function cancelHold() {
    if (!held || cancellingRef.current || deposit.isPending || holdExpired) return
    cancellingRef.current = true
    try {
      await cancel.mutateAsync({ id: held.bookingId, ...(me ? {} : { code: held.code }) })
      doneRef.current = true
      setConfirmCancel(false)
      navigate('/search', { replace: true })
    } catch {
      // Keep the booking and confirmation available for retry after failure.
    } finally {
      cancellingRef.current = false
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

      {activeBooking && (
        <div className="mt-6 space-y-4">
          <Alert tone={activeResolved ? 'success' : 'danger'}>
            {activeResolved
              ? `Booking ${activeBooking.code} đã được huỷ. Bạn có thể tiếp tục đặt phòng mới.`
              : getErrorMessage(
                  hold.error,
                  'Bạn đang có booking chưa hoàn tất. Vui lòng xem hoặc huỷ booking hiện tại trước khi đặt phòng mới.',
                )}
            {!activeResolved && activeRemaining !== null && (
              <p className="mt-2">
                {activeExpired
                  ? 'Đã hết hạn giữ phòng. Bạn có thể thử tiếp tục; hệ thống sẽ kiểm tra lại trạng thái booking.'
                  : `Hạn giữ phòng còn ${formatRemaining(activeRemaining)}.`}
              </p>
            )}
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-full">
              <Link to={existingBookingTo}>Xem booking hiện tại</Link>
            </Button>
            {!activeResolved && (
              <Button
                variant="destructive"
                className="rounded-full"
                disabled={activeExpired || cancel.isPending}
                onClick={() => {
                  cancel.reset()
                  setConfirmCancel(true)
                }}
              >
                Huỷ booking hiện tại
              </Button>
            )}
            {(activeResolved || activeExpired) && (
              <Button
                className="rounded-full"
                disabled={hold.isPending || cancel.isPending}
                onClick={retryHold}
              >
                Tiếp tục đặt phòng mới
              </Button>
            )}
          </div>
        </div>
      )}

      {hold.isError && !activeBooking && (
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
        <form
          noValidate
          onSubmit={onSubmit}
          className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px]"
        >
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

            {held.status === 'PENDING_DEPOSIT' ? (
              <Panel className="p-1">
                <h2 className="text-lg font-semibold">Thanh toán cọc</h2>
                <KeyValue k="Mã đặt phòng" v={held.code} />
                <RadioGroup
                  value="VNPAY"
                  aria-label="Phương thức thanh toán"
                  className="mt-4 grid gap-3"
                >
                  <Label
                    htmlFor="checkout-vnpay"
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-primary bg-primary/5 p-4"
                  >
                    <RadioGroupItem value="VNPAY" id="checkout-vnpay" />
                    <CreditCard className="size-4 text-primary" />
                    <span>
                      <span className="block font-medium">VNPay</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Ứng dụng ngân hàng, QR hoặc thẻ nội địa
                      </span>
                    </span>
                  </Label>
                </RadioGroup>
                {deposit.isError && (
                  <div
                    role="alert"
                    className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
                  >
                    {getErrorMessage(deposit.error)}
                  </div>
                )}
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={holdExpired || deposit.isPending || cancel.isPending}
                    aria-busy={deposit.isPending}
                    onClick={() => void payDeposit()}
                  >
                    {deposit.isPending
                      ? 'Đang chuyển sang VNPay…'
                      : `Thanh toán ${vnd(held.depositAmount)}`}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full text-destructive hover:bg-destructive/10"
                    disabled={holdExpired || cancel.isPending || deposit.isPending}
                    onClick={() => setConfirmCancel(true)}
                  >
                    <XCircle className="size-4" />
                    Huỷ booking
                  </Button>
                </div>
              </Panel>
            ) : (
              <>
                {!holdExpired && editorTypes.length > 0 && (
                  <Panel title="Số lượng phòng">
                    <p className="mb-4 text-sm text-muted-foreground">
                      Chọn số phòng cho mỗi loại rồi bấm cập nhật. Hệ thống giữ đúng số phòng bạn
                      chọn, không vượt quá số phòng còn trống.
                    </p>
                    <ul className="divide-y divide-border">
                      {editorTypes.map((type) => {
                        const count = qty[type.roomTypeId] ?? 0
                        const max = type.pool.length
                        return (
                          <li
                            key={type.roomTypeId}
                            className="flex flex-wrap items-center justify-between gap-4 py-3"
                          >
                            <div>
                              <span className="font-medium text-foreground">{type.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {vnd(type.price)} / đêm · còn {max} phòng
                              </span>
                            </div>
                            <div
                              className="flex items-center gap-1"
                              role="group"
                              aria-label={`Số phòng ${type.name}`}
                            >
                              <Button
                                type="button"
                                variant="outline"
                                className="size-9 rounded-full p-0"
                                aria-label={`Bớt phòng ${type.name}`}
                                disabled={count === 0}
                                onClick={() => changeRoomQty(type.roomTypeId, -1, max)}
                              >
                                <Minus className="size-4" />
                              </Button>
                              <span
                                className="w-8 text-center font-medium tabular-nums"
                                aria-live="polite"
                                aria-label={`${count} phòng ${type.name}`}
                              >
                                {count}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                className="size-9 rounded-full p-0"
                                aria-label={`Thêm phòng ${type.name}`}
                                disabled={count >= max}
                                onClick={() => changeRoomQty(type.roomTypeId, 1, max)}
                              >
                                <Plus className="size-4" />
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                    {updateRooms.isError && (
                      <div
                        role="alert"
                        className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
                      >
                        {getErrorMessage(
                          updateRooms.error,
                          'Không cập nhật được số phòng. Vui lòng thử lại.',
                        )}
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        className="rounded-full"
                        onClick={() => void applyRooms()}
                        disabled={!roomsChanged || nextRoomIds.length < 1 || updateRooms.isPending}
                        aria-busy={updateRooms.isPending}
                      >
                        {updateRooms.isPending ? 'Đang cập nhật…' : 'Cập nhật số phòng'}
                      </Button>
                    </div>
                  </Panel>
                )}

                <Panel title="Thông tin liên hệ">
                  {me && (
                    <p className="mb-4 text-sm text-muted-foreground">
                      Đặt với tài khoản {me.email}. Bạn có thể sửa tên và số điện thoại nếu cần.
                    </p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Họ tên"
                      htmlFor="guestName"
                      required
                      error={contactErrors.guestName}
                    >
                      <Input
                        id="guestName"
                        required
                        maxLength={120}
                        aria-invalid={Boolean(contactErrors.guestName)}
                        className={cn(contactErrors.guestName && INVALID_INPUT_CLASS)}
                        value={guestName}
                        onChange={(e) => {
                          setGuestName(e.target.value)
                          clearContactError('guestName')
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Email"
                      htmlFor="guestEmail"
                      required
                      error={contactErrors.guestEmail}
                    >
                      <Input
                        id="guestEmail"
                        type="email"
                        required
                        maxLength={160}
                        aria-invalid={Boolean(contactErrors.guestEmail)}
                        className={cn(contactErrors.guestEmail && INVALID_INPUT_CLASS)}
                        value={guestEmail}
                        onChange={(e) => {
                          setGuestEmail(e.target.value)
                          clearContactError('guestEmail')
                        }}
                      />
                    </FormField>
                    <div className="sm:col-span-2">
                      <FormField
                        label="Số điện thoại"
                        htmlFor="guestPhone"
                        required
                        error={contactErrors.guestPhone}
                      >
                        <Input
                          id="guestPhone"
                          type="tel"
                          required
                          placeholder="0900000000"
                          aria-invalid={Boolean(contactErrors.guestPhone)}
                          className={cn(contactErrors.guestPhone && INVALID_INPUT_CLASS)}
                          value={guestPhone}
                          onChange={(e) => {
                            setGuestPhone(e.target.value)
                            clearContactError('guestPhone')
                          }}
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
                      Chọn trước, hệ thống tạo yêu cầu dịch vụ khi đặt phòng được xác nhận. Phí dịch
                      vụ thanh toán trong thời gian lưu trú.
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
                                onCheckedChange={(checked) =>
                                  toggleService(svc.id, Boolean(checked))
                                }
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
                                  onChange={(e) =>
                                    setServiceQuantity(svc.id, Number(e.target.value))
                                  }
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

                {submitBanner && (
                  <div
                    role="alert"
                    className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
                  >
                    {submitBanner}
                  </div>
                )}

                {cancel.isError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
                  >
                    {getErrorMessage(cancel.error, 'Không huỷ được giữ phòng. Vui lòng thử lại.')}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    to="/search"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    ← Chọn lại phòng
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full text-destructive hover:bg-destructive/10"
                    onClick={() => void cancelHold()}
                    disabled={cancel.isPending}
                    aria-busy={cancel.isPending}
                  >
                    <XCircle className="size-4" />
                    {cancel.isPending ? 'Đang huỷ…' : 'Huỷ giữ phòng'}
                  </Button>
                </div>
              </>
            )}
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

            {held.status === 'ROOM_HELD' && (
              <Button
                type="submit"
                className="w-full rounded-full"
                disabled={holdExpired || submit.isPending}
                aria-busy={submit.isPending}
              >
                {submit.isPending ? 'Đang chuyển sang thanh toán…' : 'Tiếp tục đặt cọc'}
              </Button>
            )}
          </aside>
        </form>
      )}

      <AlertDialog
        open={confirmCancel}
        onOpenChange={(open) => {
          if (!cancellingRef.current) setConfirmCancel(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận huỷ booking</AlertDialogTitle>
            <AlertDialogDescription>
              Huỷ booking {activeBooking?.code ?? held?.code}? Phòng đang giữ sẽ được mở lại. Thao
              tác không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancel.isError && (
            <div role="alert" className="text-sm text-destructive">
              {getErrorMessage(cancel.error, 'Không huỷ được booking. Vui lòng thử lại.')}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancel.isPending || (activeBooking ? activeExpired : holdExpired)}
              onClick={(event) => {
                event.preventDefault()
                void (activeBooking ? cancelActiveBooking() : cancelHold())
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancel.isPending ? 'Đang huỷ…' : 'Xác nhận huỷ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          // Đóng dialog mà chưa xác nhận rời (Esc/nút Ở lại) -> huỷ chặn, ở lại trang.
          if (!open && !doneRef.current) blocker.reset?.()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rời trang khi đang giữ phòng?</AlertDialogTitle>
            <AlertDialogDescription>
              {held?.status === 'PENDING_DEPOSIT'
                ? 'Bạn chưa thanh toán cọc. Rời trang không tự động huỷ booking. Bạn có thể quay lại thanh toán trước khi hết hạn giữ phòng.'
                : 'Bạn chưa đặt cọc. Nếu rời trang, phần giữ phòng và đơn đặt hiện tại sẽ bị huỷ và phòng được mở lại cho khách khác.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ở lại trang này</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmLeave()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {held?.status === 'PENDING_DEPOSIT' ? 'Rời trang' : 'Rời & huỷ giữ phòng'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
