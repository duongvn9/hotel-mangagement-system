import { LogIn } from 'lucide-react'
import { Button } from '@/components/atoms'
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

interface CheckInConfirmDialogProps {
  booking: BookingListItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}

/** Bước đối chiếu thông tin khách trước khi nhận phòng; chỉ Check In khi lễ tân bấm xác nhận. */
export function CheckInConfirmDialog({
  booking,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: CheckInConfirmDialogProps) {
  const rooms =
    booking.rooms
      .map((room) => [room.roomNumber, room.roomTypeName].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join(', ') || 'Chưa gán'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Xác nhận nhận phòng — {booking.code}</DialogTitle>
          <DialogDescription>
            Đối chiếu thông tin khách với giấy tờ rồi xác nhận để nhận phòng.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y py-2">
          <KeyValue
            k="Họ tên"
            v={<span className="break-words">{booking.guestName || '—'}</span>}
          />
          <KeyValue k="Số điện thoại" v={booking.guestPhone || '—'} />
          <KeyValue k="Email" v={<span className="break-all">{booking.guestEmail || '—'}</span>} />
          <KeyValue k="Phòng" v={rooms} />
          <KeyValue k="Nhận phòng" v={fdate(booking.checkIn)} />
          <KeyValue k="Trả phòng" v={fdate(booking.checkOut)} />
          <KeyValue
            k="Số khách"
            v={`${booking.adultCount} người lớn · ${booking.childCount} trẻ em`}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-full"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button className="rounded-full" disabled={pending} onClick={onConfirm}>
            <LogIn className="size-4" />
            Xác nhận nhận phòng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
