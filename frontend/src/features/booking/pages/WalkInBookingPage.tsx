import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Button, Input, StatusBadge } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { CreateWalkInBookingInput, WalkInBooking } from '../api'
import { useAvailability, useCreateWalkInBooking } from '../hooks'
import { formatDate, money, nightsBetween, todayISO } from '../utils'

/** UC08 — Create Booking for Guest. Lễ tân chọn phòng trống rồi đặt hộ khách vãng lai, vào thẳng CONFIRMED. */
export function WalkInBookingPage() {
  // Từ trang tìm khách (UC14): điền sẵn thông tin khách cũ, lễ tân vẫn sửa được.
  const [params] = useSearchParams()
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
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
  const [created, setCreated] = useState<WalkInBooking | null>(null)

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
    if (!criteria || selected.length === 0) return
    try {
      setCreated(
        await create.mutateAsync({
          rooms: selected,
          ...criteria,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          guestPhone: guestPhone.trim(),
        }),
      )
    } catch {
      // Lỗi hiển thị qua create.isError bên dưới.
    }
  }

  function startOver() {
    setCreated(null)
    setCriteria(null)
    setSelected([])
    setGuestName('')
    setGuestEmail('')
    setGuestPhone('')
    create.reset()
  }

  if (created) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          eyebrow="Lễ tân"
          title="Đã tạo booking"
          subtitle="Booking đã xác nhận, phòng đã được giữ cho khách."
        />
        <Panel className="space-y-4 p-6">
          <Alert tone="success">Booking đã xác nhận, phòng đã được giữ cho khách.</Alert>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Mã booking</dt>
              <dd className="text-2xl font-semibold tracking-wide text-primary tabular-nums">
                {created.code}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Trạng thái</dt>
              <dd>
                <StatusBadge status={created.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Lưu trú</dt>
              <dd className="font-semibold text-foreground">
                {formatDate(created.checkIn)} – {formatDate(created.checkOut)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tiền phòng</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {money.format(created.roomTotal)}
              </dd>
            </div>
          </dl>
        </Panel>
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
        subtitle="Booking tại quầy được xác nhận ngay, không cần đặt cọc online."
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
        <form onSubmit={submitBooking} className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
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
                <FormField label="Họ tên" htmlFor="walkin-guest-name" required>
                  <Input
                    id="walkin-guest-name"
                    required
                    maxLength={120}
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                  />
                </FormField>
                <FormField label="Email" htmlFor="walkin-guest-email" required>
                  <Input
                    id="walkin-guest-email"
                    type="email"
                    required
                    maxLength={160}
                    value={guestEmail}
                    onChange={(event) => setGuestEmail(event.target.value)}
                  />
                </FormField>
                <FormField
                  label="Số điện thoại"
                  htmlFor="walkin-guest-phone"
                  required
                  className="sm:col-span-2"
                >
                  <Input
                    id="walkin-guest-phone"
                    type="tel"
                    required
                    placeholder="0900000000"
                    value={guestPhone}
                    onChange={(event) => setGuestPhone(event.target.value)}
                  />
                </FormField>
              </div>
            </Panel>

            {create.isError && <Alert tone="danger">{getErrorMessage(create.error)}</Alert>}
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
              disabled={selected.length === 0 || create.isPending}
            >
              Tạo booking
            </Button>
          </aside>
        </form>
      )}
    </PageContainer>
  )
}
