import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Input, StatusBadge } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { BOOKING_STATUS_DISPLAY, type BookingListItem } from '../api'
import { useAvailability, useBookingList, useUpdateBooking } from '../hooks'
import { money, nightsBetween, toBusinessDate } from '../utils'

/** Trạng thái còn sửa được (UC11): trước khi nhận phòng và chưa huỷ. */
const EDITABLE_STATUSES = ['PENDING_DEPOSIT', 'CONFIRMED']

/** UC11 — Update Booking. Lễ tân/Quản lý sửa ngày, phòng, số khách và thông tin liên hệ. */
export function EditBookingPage() {
  const { code = '' } = useParams()
  // Chưa có API đọc chi tiết (UC09), nên tìm booking theo mã bằng danh sách UC10.
  const list = useBookingList({ page: 1, limit: 20, q: code })
  const booking = list.data?.items.find((entry) => entry.code === code)

  let body
  if (list.isPending) {
    body = <p className="text-sm text-muted-foreground">Đang tải…</p>
  } else if (list.isError) {
    body = <Alert tone="danger">{getErrorMessage(list.error)}</Alert>
  } else if (!booking) {
    body = <Alert tone="warning">Không tìm thấy booking này.</Alert>
  } else if (!EDITABLE_STATUSES.includes(booking.status)) {
    body = (
      <Alert tone="warning">
        Booking {booking.code} ở trạng thái{' '}
        {BOOKING_STATUS_DISPLAY[booking.status]?.label ?? booking.status} nên không thể sửa.
      </Alert>
    )
  } else {
    body = <EditBookingForm booking={booking} />
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Lễ tân"
        title={`Sửa booking ${code}`}
        subtitle="Cập nhật thời gian ở, chọn lại phòng hoặc sửa thông tin khách."
      />
      {body}
      <Link
        to="/reception/bookings"
        className="inline-flex h-11 items-center text-sm font-semibold tracking-wider text-muted-foreground uppercase transition-colors hover:text-primary"
      >
        ← Danh sách booking
      </Link>
    </PageContainer>
  )
}

function EditBookingForm({ booking }: { booking: BookingListItem }) {
  const navigate = useNavigate()
  const update = useUpdateBooking()

  const [checkIn, setCheckIn] = useState(toBusinessDate(booking.checkIn))
  const [checkOut, setCheckOut] = useState(toBusinessDate(booking.checkOut))
  const [adultCount, setAdultCount] = useState(String(booking.adultCount))
  const [childCount, setChildCount] = useState(String(booking.childCount))
  const [guestName, setGuestName] = useState(booking.guestName ?? '')
  const [guestEmail, setGuestEmail] = useState(booking.guestEmail ?? '')
  const [guestPhone, setGuestPhone] = useState(booking.guestPhone ?? '')
  const [selected, setSelected] = useState(booking.rooms.map((room) => room.id))

  const nights = nightsBetween(checkIn, checkOut)
  const adults = Number(adultCount)
  const children = Number(childCount)
  const criteria =
    nights > 0 &&
    Number.isInteger(adults) &&
    adults >= 1 &&
    Number.isInteger(children) &&
    children >= 0
      ? { checkIn, checkOut, adultCount: adults, childCount: children }
      : null
  const availability = useAvailability(
    criteria ? { checkIn, checkOut, guests: criteria.adultCount + criteria.childCount } : null,
  )

  // Phòng hiện tại luôn chọn lại được (kết quả tìm phòng loại trừ chính booking đang giữ chúng);
  // server vẫn kiểm tra lại phòng trống khi lưu.
  const options = useMemo(() => {
    const current = booking.rooms.map((room) => ({
      id: room.id,
      label: [room.roomNumber, room.roomTypeName].filter(Boolean).join(' · ') || 'Phòng',
      note: 'Đang đặt',
      pricePerNight: undefined as number | undefined,
    }))
    const currentIds = new Set(current.map((room) => room.id))
    const countByType = new Map<string, number>()
    const others = (availability.data ?? [])
      .filter((room) => !currentIds.has(room.id))
      .map((room) => {
        const index = (countByType.get(room.roomTypeId) ?? 0) + 1
        countByType.set(room.roomTypeId, index)
        return {
          id: room.id,
          label: `${room.roomTypeName ?? 'Phòng'} · Phòng trống ${index}`,
          note: 'Còn trống',
          pricePerNight: room.pricePerNight,
        }
      })
    return [...current, ...others]
  }, [booking.rooms, availability.data])

  function toggle(id: string) {
    setSelected((value) =>
      value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id],
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (selected.length === 0 || !criteria) return
    try {
      await update.mutateAsync({
        id: booking.id,
        input: {
          rooms: selected,
          ...criteria,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestPhone: guestPhone.trim(),
        },
      })
      navigate(`/reception/bookings/${encodeURIComponent(booking.code)}`)
    } catch {
      // Lỗi hiển thị qua update.isError bên dưới.
    }
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <Panel title="Thời gian ở">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nhận phòng" htmlFor="edit-check-in" required>
              <Input
                id="edit-check-in"
                type="date"
                required
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
              />
            </FormField>
            <FormField label="Trả phòng" htmlFor="edit-check-out" required>
              <Input
                id="edit-check-out"
                type="date"
                required
                min={checkIn || undefined}
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
              />
            </FormField>
            <FormField label="Người lớn" htmlFor="edit-adult-count" required>
              <Input
                id="edit-adult-count"
                type="number"
                required
                min={1}
                step={1}
                value={adultCount}
                onChange={(event) => setAdultCount(event.target.value)}
              />
            </FormField>
            <FormField label="Trẻ em" htmlFor="edit-child-count" required>
              <Input
                id="edit-child-count"
                type="number"
                required
                min={0}
                step={1}
                value={childCount}
                onChange={(event) => setChildCount(event.target.value)}
              />
            </FormField>
          </div>
        </Panel>

        <Panel title="Phòng">
          <ul className="grid gap-2 sm:grid-cols-2">
            {options.map((room) => {
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
                    <span className="flex-1">
                      <span className="font-medium">{room.label}</span>
                      <span className="block text-xs text-muted-foreground">{room.note}</span>
                    </span>
                    {room.pricePerNight !== undefined && (
                      <span className="tabular-nums text-muted-foreground">
                        {money.format(room.pricePerNight)}/đêm
                      </span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
          {availability.isError && (
            <div className="mt-3">
              <Alert tone="danger">{getErrorMessage(availability.error)}</Alert>
            </div>
          )}
        </Panel>

        <Panel title="Thông tin khách">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Họ tên" htmlFor="edit-guest-name" required>
              <Input
                id="edit-guest-name"
                required
                maxLength={120}
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
              />
            </FormField>
            <FormField label="Email" htmlFor="edit-guest-email" required>
              <Input
                id="edit-guest-email"
                type="email"
                required
                maxLength={160}
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
              />
            </FormField>
            <FormField
              label="Số điện thoại"
              htmlFor="edit-guest-phone"
              required
              className="sm:col-span-2"
            >
              <Input
                id="edit-guest-phone"
                type="tel"
                required
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
              />
            </FormField>
          </div>
        </Panel>

        {update.isError && <Alert tone="danger">{getErrorMessage(update.error)}</Alert>}
      </div>

      <aside className="card-soft h-fit space-y-4 p-6 lg:sticky lg:top-6">
        <h2 className="font-display text-xl font-semibold text-foreground">Tóm tắt</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Trạng thái</dt>
            <dd>
              <StatusBadge status={booking.status} />
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Số đêm</dt>
            <dd className="font-semibold text-foreground">{nights}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Phòng đã chọn</dt>
            <dd className="font-semibold text-foreground">{selected.length}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Tiền phòng hiện tại</dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {money.format(booking.roomTotal)}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Khi lưu, hệ thống kiểm tra lại phòng trống và tính lại tiền phòng. Tiền cọc đã nhận của
          booking đã xác nhận được giữ nguyên.
        </p>
        <Button
          type="submit"
          className="w-full rounded-full"
          disabled={selected.length === 0 || !criteria || update.isPending}
        >
          Lưu thay đổi
        </Button>
      </aside>
    </form>
  )
}
