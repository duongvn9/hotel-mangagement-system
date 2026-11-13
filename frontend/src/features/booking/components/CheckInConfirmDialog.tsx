import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LogIn } from 'lucide-react'
import { ImagePicker } from '@/components/ImagePicker'
import { Button, Checkbox } from '@/components/atoms'
import { KeyValue } from '@/components/molecules'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/organisms'
import { fdate } from '@/lib/format'
import type { BookingListItem } from '../api'

/** Reception attaches between 1 and this many ID photos (the server enforces the same limit). */
const MAX_PHOTOS = 5

interface CheckInConfirmDialogProps {
  booking: BookingListItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (files: File[]) => void
  pending: boolean
}

/** Step where reception compares the guest details with their ID before checking in. */
export function CheckInConfirmDialog({
  booking,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: CheckInConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Xác nhận nhận phòng — {booking.code}</DialogTitle>
          <DialogDescription>
            Đối chiếu thông tin khách với giấy tờ, tick từng mục đã kiểm tra rồi xác nhận để nhận
            phòng.
          </DialogDescription>
        </DialogHeader>

        <CheckInChecklist
          booking={booking}
          pending={pending}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  )
}

/** A value reception has to verify, with the box they tick once it matches the ID. */
function Verified({
  label,
  checked,
  onChange,
  children,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <span className="flex items-center justify-end gap-3">
      <span>{children}</span>
      <Checkbox
        aria-label={label}
        checked={checked}
        onCheckedChange={(next) => onChange(next === true)}
      />
    </span>
  )
}

/**
 * Everything the receptionist fills in lives here, inside DialogContent, so it is discarded when
 * the dialog closes: reopening always starts blank and never carries over a previous guest's
 * ticks or ID photo.
 */
function CheckInChecklist({
  booking,
  pending,
  onCancel,
  onConfirm,
}: {
  booking: BookingListItem
  pending: boolean
  onCancel: () => void
  onConfirm: (files: File[]) => void
}) {
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const [nameChecked, setNameChecked] = useState(false)
  const [phoneChecked, setPhoneChecked] = useState(false)
  const [guestsChecked, setGuestsChecked] = useState(false)

  // Blob URLs are revoked when a photo is removed and, through this ref, when the step is torn down.
  const urls = useRef<string[]>([])
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url))
    },
    [],
  )

  const rooms =
    booking.rooms
      .map((room) => [room.roomNumber, room.roomTypeName].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join(', ') || 'Chưa gán'
  const ready = photos.length > 0 && nameChecked && phoneChecked && guestsChecked

  return (
    <>
      <div className="divide-y py-2">
        <KeyValue
          k="Họ tên"
          v={
            <Verified label="Đã đối chiếu họ tên" checked={nameChecked} onChange={setNameChecked}>
              <span className="break-words">{booking.guestName || '—'}</span>
            </Verified>
          }
        />
        <KeyValue
          k="Số điện thoại"
          v={
            <Verified
              label="Đã đối chiếu số điện thoại"
              checked={phoneChecked}
              onChange={setPhoneChecked}
            >
              {booking.guestPhone || '—'}
            </Verified>
          }
        />
        <KeyValue k="Email" v={<span className="break-all">{booking.guestEmail || '—'}</span>} />
        <KeyValue k="Phòng" v={rooms} />
        <KeyValue k="Nhận phòng" v={fdate(booking.checkIn)} />
        <KeyValue k="Trả phòng" v={fdate(booking.checkOut)} />
        <KeyValue
          k="Số khách"
          v={
            <Verified
              label="Đã đối chiếu số khách"
              checked={guestsChecked}
              onChange={setGuestsChecked}
            >
              {`${booking.adultCount} người lớn · ${booking.childCount} trẻ em`}
            </Verified>
          }
        />
      </div>

      <ImagePicker
        appearance="prototype"
        label="Ảnh CCCD/giấy tờ"
        name={booking.guestName || booking.code}
        max={MAX_PHOTOS}
        images={photos.map((photo, index) => ({
          src: photo.url,
          label: `Ảnh giấy tờ ${index + 1}`,
        }))}
        onChoose={(files) => {
          const room = MAX_PHOTOS - photos.length
          const added = files.slice(0, Math.max(room, 0)).map((file) => ({
            file,
            url: URL.createObjectURL(file),
          }))
          urls.current.push(...added.map((photo) => photo.url))
          setPhotos((current) => [...current, ...added])
        }}
        onRemove={(index) => {
          const removed = photos[index]
          if (removed) URL.revokeObjectURL(removed.url)
          setPhotos((current) => current.filter((_, position) => position !== index))
        }}
      />

      <DialogFooter>
        <Button variant="outline" className="rounded-full" disabled={pending} onClick={onCancel}>
          Hủy
        </Button>
        <Button
          className="rounded-full"
          disabled={pending || !ready}
          onClick={() => onConfirm(photos.map((photo) => photo.file))}
        >
          <LogIn className="size-4" />
          Xác nhận nhận phòng
        </Button>
      </DialogFooter>
    </>
  )
}
