import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import {
  createRoomType,
  getAmenityOptions,
  getRoomType,
  updateRoomType,
  type RoomType,
  type RoomTypeInput,
} from '../api'

export function RoomTypeEditor({
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
    queryKey: ['room-type', id],
    queryFn: () => getRoomType(id!),
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
      aria-labelledby="room-type-form-title"
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-lg border border-stone-300 bg-white p-6 font-body text-pearl-900 backdrop:bg-pearl-900/50"
      onCancel={(event) => {
        event.preventDefault()
        if (!dialog.current?.querySelector('[aria-busy="true"]')) onClose()
      }}
    >
      <h2 id="room-type-form-title" className="mb-6 font-display text-3xl">
        {id ? 'Sửa loại phòng' : 'Thêm loại phòng'}
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
        <RoomTypeForm
          initial={id ? query.data : undefined}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </dialog>
  )
}

const confirmation =
  'Loại phòng được giữ lại, booking đang hoạt động vẫn hợp lệ nhưng không nhận đặt phòng mới. Bạn muốn ngừng loại phòng này?'

export function RoomTypeForm({
  initial,
  onClose,
  onSuccess,
}: {
  initial?: RoomType
  onClose: () => void
  onSuccess: () => void
}) {
  const form = useRef<HTMLFormElement>(null)
  const locked = useRef(false)
  const client = useQueryClient()
  const options = useQuery({ queryKey: ['amenity-options'], queryFn: getAmenityOptions })
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? ''))
  const [price, setPrice] = useState(
    initial ? new Intl.NumberFormat('vi-VN').format(initial.basePrice) : '',
  )
  const [selected, setSelected] = useState(initial?.amenities.map((a) => a.id) ?? [])
  const [active, setActive] = useState(initial?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const focusError = () =>
    window.setTimeout(
      () => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      0,
    )
  const mutation = useMutation({
    mutationFn: (input: Partial<RoomTypeInput>) =>
      initial ? updateRoomType(initial.id, input) : createRoomType(input as RoomTypeInput),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['room-types'] }),
        client.invalidateQueries({ queryKey: ['room-type', initial?.id] }),
      ])
      onSuccess()
    },
    onError: (error) => {
      const message = getErrorMessage(error)
      if (axios.isAxiosError(error) && error.response?.status === 409 && /tên/i.test(message))
        setErrors({ name: message })
      else if (/amenit|tiện nghi/i.test(message)) setErrors({ amenities: message })
      else setGeneral(message)
      focusError()
    },
    onSettled: () => {
      locked.current = false
    },
  })
  function save(event?: FormEvent, deactivate = false) {
    event?.preventDefault()
    if (locked.current) return
    setGeneral('')
    if (deactivate) {
      if (!window.confirm(confirmation)) return
      locked.current = true
      mutation.mutate({ isActive: false })
      return
    }
    const next: Record<string, string> = {}
    const amount = Number(price.replaceAll('.', ''))
    if (!name.trim() || name.trim().length > 100)
      next.name = 'Nhập tên loại phòng (tối đa 100 ký tự).'
    if (!capacity.trim() || !Number.isSafeInteger(Number(capacity)) || Number(capacity) < 1)
      next.capacity = 'Sức chứa phải là số nguyên từ 1.'
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(price) || !Number.isSafeInteger(amount) || amount <= 0)
      next.basePrice = 'Giá phải là số nguyên VND lớn hơn 0.'
    setErrors(next)
    if (Object.keys(next).length) {
      focusError()
      return
    }
    const isActive = deactivate ? false : active
    if (initial?.isActive && !isActive && !window.confirm(confirmation)) return
    const input: RoomTypeInput = {
      name: name.trim(),
      description: description.trim(),
      capacity: Number(capacity),
      basePrice: amount,
      amenities: selected,
      isActive,
    }
    const changes: Partial<RoomTypeInput> = initial
      ? Object.fromEntries(
          Object.entries(input).filter(
            ([key, value]) =>
              JSON.stringify(value) !==
              JSON.stringify(
                key === 'amenities'
                  ? initial.amenities.map((a) => a.id)
                  : initial[key as keyof RoomType],
              ),
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
    ...(options.data ?? []),
    ...(initial?.amenities.filter((a) => !options.data?.some((o) => o.id === a.id)) ?? []).map(
      (a) => ({ ...a, name: a.isActive === false ? `${a.name} (ngừng)` : a.name }),
    ),
  ]
  return (
    <form
      ref={form}
      noValidate
      onSubmit={save}
      className="space-y-4"
      aria-busy={mutation.isPending}
    >
      {general && <Alert tone="danger">{general}</Alert>}
      <fieldset disabled={mutation.isPending} className="space-y-4">
        <TextField
          label="Tên loại phòng"
          required
          maxLength={100}
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />
        <TextField
          label="Mô tả"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <TextField
          label="Sức chứa"
          required
          type="number"
          min={1}
          step={1}
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          error={errors.capacity}
        />
        <TextField
          label="Giá VND"
          required
          inputMode="numeric"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          onBlur={() => {
            const number = Number(price.replaceAll('.', ''))
            if (
              /^(\d{1,3}(\.\d{3})*|\d+)$/.test(price) &&
              Number.isSafeInteger(number) &&
              number > 0
            )
              setPrice(new Intl.NumberFormat('vi-VN').format(number))
          }}
          error={errors.basePrice}
        />
        <fieldset
          tabIndex={-1}
          aria-invalid={errors.amenities ? true : undefined}
          aria-describedby={errors.amenities ? 'amenities-error' : undefined}
          className="rounded border border-stone-300 p-3"
        >
          <legend className="text-sm font-semibold">Tiện nghi</legend>
          {options.isPending && <p role="status">Đang tải tiện nghi…</p>}
          {options.isError && (
            <>
              <Alert tone="danger">{getErrorMessage(options.error)}</Alert>
              <Button type="button" onClick={() => void options.refetch()}>
                Thử lại tiện nghi
              </Button>
            </>
          )}
          {options.isSuccess && choices.length === 0 && <p>Chưa có tiện nghi nào</p>}
          {choices.map((option) => (
            <label key={option.id} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                disabled={
                  !options.data?.some((a) => a.id === option.id) && !selected.includes(option.id)
                }
                onChange={(event) =>
                  setSelected((previous) =>
                    event.target.checked
                      ? [...previous, option.id]
                      : previous.filter((id) => id !== option.id),
                  )
                }
              />
              {option.name}
            </label>
          ))}
          {errors.amenities && (
            <p id="amenities-error" className="text-sm text-danger">
              {errors.amenities}
            </p>
          )}
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Kích hoạt
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={mutation.isPending}>
          Lưu loại phòng
        </Button>
        {initial?.isActive && (
          <Button
            type="button"
            variant="danger"
            disabled={mutation.isPending}
            onClick={() => save(undefined, true)}
          >
            Ngừng nhận đặt phòng
          </Button>
        )}
        <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>
          Hủy
        </Button>
      </div>
    </form>
  )
}
