import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button, Input, Label, NativeSelect, Textarea } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import {
  createRoom,
  getRoom,
  updateRoom,
  ROOM_STATUSES,
  ROOM_STATUS_DISPLAY,
  type Room,
  type RoomInput,
  type RoomStatus,
} from '../api'
import { useActiveRoomTypeOptions } from '../hooks'

export function RoomEditor({
  id,
  onClose,
  onSuccess,
}: {
  id: string | null
  onClose: () => void
  onSuccess: () => void
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const previous = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )
  const query = useQuery({
    queryKey: ['room', id],
    queryFn: () => getRoom(id!),
    enabled: id !== null,
  })
  const busy = () => Boolean(dialog.current?.querySelector('[aria-busy="true"]'))
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy()) onClose()
      }}
    >
      <DialogContent
        ref={dialog}
        aria-describedby={undefined}
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (busy()) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          previous.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{id ? 'Sửa phòng' : 'Thêm phòng'}</DialogTitle>
        </DialogHeader>
        {id && query.isPending ? (
          <>
            <p role="status">Đang tải chi tiết…</p>
            <Button type="button" onClick={onClose}>
              Đóng
            </Button>
          </>
        ) : id && query.isError ? (
          <>
            <Alert tone="danger">{getErrorMessage(query.error)}</Alert>
            <Button type="button" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
            <Button type="button" onClick={onClose}>
              Đóng
            </Button>
          </>
        ) : (
          <RoomForm initial={id ? query.data : undefined} onClose={onClose} onSuccess={onSuccess} />
        )}
      </DialogContent>
    </Dialog>
  )
}

const deactivateMessage =
  'Phòng được giữ lại, reservation đang hoạt động vẫn hợp lệ, nhưng phòng không nhận đặt phòng mới. Bạn muốn ngừng phòng này?'
const reactivateMessage =
  'Bạn muốn kích hoạt lại phòng này để nhận đặt phòng mới? Loại phòng phải còn hoạt động.'

export function RoomForm({
  initial,
  onClose,
  onSuccess,
}: {
  initial?: Room
  onClose: () => void
  onSuccess: () => void
}) {
  const form = useRef<HTMLFormElement>(null)
  const locked = useRef(false)
  const client = useQueryClient()
  const options = useActiveRoomTypeOptions()
  const [roomNumber, setRoomNumber] = useState(initial?.roomNumber ?? '')
  const [floor, setFloor] = useState(String(initial?.floor ?? ''))
  const [roomType, setRoomType] = useState(initial?.roomType?.id ?? '')
  const [status, setStatus] = useState<RoomStatus>(initial?.status ?? 'AVAILABLE')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [active, setActive] = useState(initial?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [confirmationToggle, setConfirmationToggle] = useState<boolean | null>(null)
  const focusError = () =>
    window.setTimeout(
      () => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      0,
    )
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [])
  const mutation = useMutation({
    mutationFn: (input: Partial<RoomInput>) =>
      initial ? updateRoom(initial.id, input) : createRoom(input as RoomInput),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['rooms'] }),
        client.invalidateQueries({ queryKey: ['room', initial?.id] }),
      ])
      onSuccess()
    },
    onError: (error) => {
      const message = getErrorMessage(error)
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 409 &&
        /số phòng|roomNumber/i.test(message)
      )
        setErrors({ roomNumber: message })
      else if (/roomType|loại phòng/i.test(message)) setErrors({ roomType: message })
      else {
        const raw = axios.isAxiosError(error) ? error.response?.data?.message : undefined
        const messages: string[] = Array.isArray(raw) ? raw : [message]
        const fields = Object.fromEntries(
          ['roomNumber', 'floor', 'status', 'notes', 'isActive'].flatMap((field) => {
            const matched = messages.filter((text) => text.includes(field))
            return matched.length ? [[field, matched.join(', ')]] : []
          }),
        )
        if (Object.keys(fields).length) setErrors(fields)
        else setGeneral(message)
      }
      focusError()
    },
    onSettled: () => {
      locked.current = false
    },
  })
  function save(event?: FormEvent, toggle = false, confirmed = false) {
    event?.preventDefault()
    if (locked.current) return
    setGeneral('')
    const next: Record<string, string> = {}
    const nextActive = toggle ? !initial!.isActive : active
    if (!roomNumber.trim()) next.roomNumber = 'Nhập số phòng.'
    if (!floor.trim() || !Number.isSafeInteger(Number(floor)))
      next.floor = 'Tầng phải là số nguyên an toàn.'
    const mustValidateType =
      !initial || roomType !== initial.roomType?.id || (!initial.isActive && nextActive)
    if (mustValidateType && !options.data?.some((type) => type.id === roomType))
      next.roomType = 'Chọn loại phòng còn hoạt động trước khi tạo, đổi loại hoặc kích hoạt lại.'
    if (!ROOM_STATUSES.includes(status)) next.status = 'Chọn trạng thái vận hành hợp lệ.'
    // Deactivation alone must remain possible, even with stale/invalid editable fields.
    if (toggle && initial?.isActive) {
      setErrors({})
      if (!confirmed) {
        setConfirmationToggle(true)
        return
      }
      locked.current = true
      mutation.mutate({ isActive: false })
      return
    }
    setErrors(next)
    if (Object.keys(next).length) {
      focusError()
      return
    }
    if (initial && nextActive !== initial.isActive && !confirmed) {
      setConfirmationToggle(toggle)
      return
    }
    const input: RoomInput = {
      roomNumber: roomNumber.trim(),
      floor: Number(floor),
      roomType,
      status,
      notes: notes.trim(),
      isActive: nextActive,
    }
    const changes: Partial<RoomInput> = initial
      ? Object.fromEntries(
          Object.entries(input).filter(
            ([key, value]) =>
              value !==
              (key === 'roomType' ? (initial.roomType?.id ?? '') : initial[key as keyof Room]),
          ),
        )
      : input
    if (!Object.keys(changes).length) {
      onClose()
      return
    }
    locked.current = true
    mutation.mutate(changes)
  }
  const choices = [
    { value: '', label: 'Chọn loại phòng' },
    ...(options.data ?? []).map((type) => ({ value: type.id, label: type.name })),
    ...(initial?.roomType && !options.data?.some((type) => type.id === initial.roomType!.id)
      ? [
          {
            value: initial.roomType.id,
            label: `${initial.roomType.name}${initial.roomType.isActive ? '' : ' (ngừng)'}`,
          },
        ]
      : []),
  ]
  const confirmingActive = confirmationToggle ? !initial?.isActive : active
  return (
    <form
      ref={form}
      noValidate
      onSubmit={save}
      aria-busy={mutation.isPending}
      className="space-y-4 py-2"
    >
      {general && <Alert tone="danger">{general}</Alert>}
      <fieldset disabled={mutation.isPending} className="grid min-w-0 grid-cols-1 gap-4">
        <FormField label="Số phòng" htmlFor="room-number" required error={errors.roomNumber}>
          <Input
            id="room-number"
            autoFocus
            required
            value={roomNumber}
            onChange={(event) => setRoomNumber(event.target.value)}
            aria-invalid={errors.roomNumber ? true : undefined}
            aria-describedby={errors.roomNumber ? 'room-number-error' : undefined}
          />
        </FormField>
        <FormField label="Tầng" htmlFor="room-floor" required error={errors.floor}>
          <Input
            id="room-floor"
            type="number"
            step={1}
            required
            value={floor}
            onChange={(event) => setFloor(event.target.value)}
            aria-invalid={errors.floor ? true : undefined}
            aria-describedby={errors.floor ? 'room-floor-error' : undefined}
          />
        </FormField>
        <div className="min-w-0 space-y-2">
          <FormField
            label="Loại phòng của phòng"
            htmlFor="room-type"
            required
            error={errors.roomType}
          >
            <NativeSelect
              id="room-type"
              required
              value={roomType}
              disabled={options.isPending || options.isError}
              aria-invalid={errors.roomType ? true : undefined}
              aria-describedby={errors.roomType ? 'room-type-error' : undefined}
              onChange={(event) => setRoomType(event.target.value)}
            >
              {choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {options.isPending && <p role="status">Đang tải loại phòng khả dụng…</p>}
          {options.isError && (
            <>
              <Alert tone="danger">{getErrorMessage(options.error)}</Alert>
              <Button
                type="button"
                disabled={options.isFetching}
                onClick={() => void options.refetch()}
              >
                Thử lại loại phòng khả dụng
              </Button>
            </>
          )}
          {options.isSuccess && !options.data.length && (
            <Alert tone="warning">
              Chưa có loại phòng hoạt động.{' '}
              <a
                className="underline focus-visible:outline-2 focus-visible:outline-ring"
                href="/manager/room-types"
              >
                Quản lý loại phòng
              </a>
            </Alert>
          )}
          {initial?.roomType?.isActive === false && (
            <p className="text-sm text-muted-foreground">
              Loại phòng hiện tại đã ngừng; chọn loại phòng hoạt động để kích hoạt lại.
            </p>
          )}
          {initial && !initial.roomType && (
            <Alert tone="warning">
              Không tìm thấy loại phòng hiện tại. Chọn loại phòng hoạt động để kích hoạt lại.
            </Alert>
          )}
        </div>
        <FormField
          label="Trạng thái vận hành của phòng"
          htmlFor="room-status"
          error={errors.status}
        >
          <NativeSelect
            id="room-status"
            value={status}
            aria-invalid={errors.status ? true : undefined}
            aria-describedby={errors.status ? 'room-status-error' : undefined}
            onChange={(event) => setStatus(event.target.value as RoomStatus)}
          >
            {ROOM_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ROOM_STATUS_DISPLAY[value].label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Ghi chú" htmlFor="room-notes" error={errors.notes}>
          <Textarea
            id="room-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={errors.notes ? 'room-notes-error' : undefined}
          />
        </FormField>
        <div>
          <Label className="flex min-h-11 items-center gap-3 text-sm">
            <Input
              type="checkbox"
              className="size-4 shrink-0"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              aria-invalid={errors.isActive ? true : undefined}
              aria-describedby={errors.isActive ? 'room-active-error' : undefined}
            />
            Đang hoạt động
          </Label>
          {errors.isActive && (
            <p id="room-active-error" role="alert" className="text-xs text-danger">
              {errors.isActive}
            </p>
          )}
        </div>
      </fieldset>
      <DialogFooter className="flex-wrap gap-2 pt-2 sm:space-x-0">
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
          Hủy
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending || (!initial && !options.data?.length)}
          aria-busy={mutation.isPending || undefined}
        >
          {mutation.isPending ? 'Đang xử lý…' : 'Lưu phòng'}
        </Button>
        {initial && (
          <Button
            type="button"
            variant={initial.isActive ? 'destructive' : 'outline'}
            disabled={mutation.isPending}
            onClick={() => save(undefined, true)}
          >
            {initial.isActive ? 'Ngừng nhận đặt phòng' : 'Kích hoạt lại phòng'}
          </Button>
        )}
      </DialogFooter>
      <AlertDialog
        open={confirmationToggle !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmationToggle(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmingActive ? 'Kích hoạt lại phòng?' : 'Ngừng nhận đặt phòng?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmingActive ? reactivateMessage : deactivateMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmingActive
                  ? undefined
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }
              onClick={() => save(undefined, confirmationToggle === true, true)}
            >
              {confirmingActive ? 'Kích hoạt lại phòng' : 'Ngừng nhận đặt phòng'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
