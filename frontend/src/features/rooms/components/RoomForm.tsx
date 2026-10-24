import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
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
  const dialog = useRef<HTMLDialogElement>(null)
  const query = useQuery({
    queryKey: ['room', id],
    queryFn: () => getRoom(id!),
    enabled: id !== null,
  })
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    return () => {
      element.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      aria-labelledby="room-form-title"
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-lg border border-stone-300 bg-white p-6 font-body text-pearl-900 backdrop:bg-pearl-900/50"
      onCancel={(event) => {
        event.preventDefault()
        if (!dialog.current?.querySelector('[aria-busy="true"]')) onClose()
      }}
    >
      <h2 id="room-form-title" className="mb-6 font-display text-3xl">
        {id ? 'Sửa phòng' : 'Thêm phòng'}
      </h2>
      {id && query.isPending ? (
        <>
          <p role="status">Đang tải chi tiết…</p>
          <Button onClick={onClose}>Đóng</Button>
        </>
      ) : id && query.isError ? (
        <>
          <Alert tone="danger">{getErrorMessage(query.error)}</Alert>
          <Button onClick={() => void query.refetch()}>Thử lại</Button>
          <Button onClick={onClose}>Đóng</Button>
        </>
      ) : (
        <RoomForm initial={id ? query.data : undefined} onClose={onClose} onSuccess={onSuccess} />
      )}
    </dialog>
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
  function save(event?: FormEvent, toggle = false) {
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
      if (!window.confirm(deactivateMessage)) return
      locked.current = true
      mutation.mutate({ isActive: false })
      return
    }
    setErrors(next)
    if (Object.keys(next).length) {
      focusError()
      return
    }
    if (
      initial &&
      nextActive !== initial.isActive &&
      !window.confirm(nextActive ? reactivateMessage : deactivateMessage)
    )
      return
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
  return (
    <form
      ref={form}
      noValidate
      onSubmit={save}
      aria-busy={mutation.isPending}
      className="space-y-4"
    >
      {general && <Alert tone="danger">{general}</Alert>}
      <fieldset disabled={mutation.isPending} className="space-y-4">
        <TextField
          label="Số phòng"
          required
          value={roomNumber}
          onChange={(event) => setRoomNumber(event.target.value)}
          error={errors.roomNumber}
        />
        <TextField
          label="Tầng"
          type="number"
          step={1}
          required
          value={floor}
          onChange={(event) => setFloor(event.target.value)}
          error={errors.floor}
        />
        <div>
          <SelectField
            label="Loại phòng của phòng"
            required
            value={roomType}
            options={choices}
            disabled={options.isPending || options.isError}
            aria-invalid={errors.roomType ? true : undefined}
            aria-describedby={errors.roomType ? 'room-type-error' : undefined}
            onChange={(event) => setRoomType(event.target.value)}
          />
          {errors.roomType && (
            <p id="room-type-error" className="mt-1 text-xs text-danger">
              {errors.roomType}
            </p>
          )}
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
              <a className="underline" href="/manager/room-types">
                Quản lý loại phòng
              </a>
            </Alert>
          )}
          {initial?.roomType?.isActive === false && (
            <p className="text-sm text-stone-700">
              Loại phòng hiện tại đã ngừng; chọn loại phòng hoạt động để kích hoạt lại.
            </p>
          )}
          {initial && !initial.roomType && (
            <Alert tone="warning">
              Không tìm thấy loại phòng hiện tại. Chọn loại phòng hoạt động để kích hoạt lại.
            </Alert>
          )}
        </div>
        <div>
          <SelectField
            label="Trạng thái vận hành của phòng"
            value={status}
            options={ROOM_STATUSES.map((value) => ({
              value,
              label: ROOM_STATUS_DISPLAY[value].label,
            }))}
            aria-invalid={errors.status ? true : undefined}
            aria-describedby={errors.status ? 'room-status-error' : undefined}
            onChange={(event) => setStatus(event.target.value as RoomStatus)}
          />
          {errors.status && (
            <p id="room-status-error" className="mt-1 text-xs text-danger">
              {errors.status}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="room-notes"
            className="mb-2 block text-xs font-semibold tracking-wider text-stone-700 uppercase"
          >
            Ghi chú
          </label>
          <textarea
            id="room-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={errors.notes ? 'room-notes-error' : undefined}
            className="min-h-11 w-full rounded border border-stone-300 bg-white px-4 py-3 text-sm hover:border-stone-500 focus:border-primary disabled:bg-stone-200"
          />
          {errors.notes && (
            <p id="room-notes-error" className="text-xs text-danger">
              {errors.notes}
            </p>
          )}
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            aria-invalid={errors.isActive ? true : undefined}
            aria-describedby={errors.isActive ? 'room-active-error' : undefined}
          />
          Đang hoạt động
        </label>
        {errors.isActive && (
          <p id="room-active-error" className="text-xs text-danger">
            {errors.isActive}
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          loading={mutation.isPending}
          disabled={!initial && !options.data?.length}
        >
          Lưu phòng
        </Button>
        {initial && (
          <Button
            type="button"
            variant={initial.isActive ? 'danger' : 'secondary'}
            disabled={mutation.isPending}
            onClick={() => save(undefined, true)}
          >
            {initial.isActive ? 'Ngừng nhận đặt phòng' : 'Kích hoạt lại phòng'}
          </Button>
        )}
        <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>
          Hủy
        </Button>
      </div>
    </form>
  )
}
