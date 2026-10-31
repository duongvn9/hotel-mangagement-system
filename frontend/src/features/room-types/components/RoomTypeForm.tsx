import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { AssetImage } from '@/components/AssetImage'
import { ImageLightbox } from '@/components/ImageLightbox'
import { assetUrl } from '@/lib/asset-url'
import {
  createRoomType,
  getAmenityOptions,
  getRoomType,
  updateRoomType,
  uploadRoomTypeImage,
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
      className="m-auto max-h-[92dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-stone-300 bg-white p-5 font-body text-pearl-900 shadow-xl backdrop:bg-pearl-900/60 sm:p-8"
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
  const [adultCapacity, setAdultCapacity] = useState(String(initial?.adultCapacity ?? ''))
  const [childCapacity, setChildCapacity] = useState(String(initial?.childCapacity ?? ''))
  const [price, setPrice] = useState(
    initial ? new Intl.NumberFormat('vi-VN').format(initial.basePrice) : '',
  )
  const [selected, setSelected] = useState(initial?.amenities.map((a) => a.id) ?? [])
  const [active, setActive] = useState(initial?.isActive ?? true)
  const [images, setImages] = useState<string[]>(initial?.images ?? [])
  const [files, setFiles] = useState<File[]>([])
  const [viewing, setViewing] = useState<number | null>(null)
  const [previewUrls, setPreviewUrls] = useState(new Map<File, string>())
  const generatedUrls = useRef<string[]>([])
  useEffect(() => {
    const urls = generatedUrls.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const focusError = () =>
    window.setTimeout(
      () => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      0,
    )
  const mutation = useMutation({
    mutationFn: async (input: Partial<RoomTypeInput>) => {
      const paths = [...(input.images ?? [])]
      // Keep successful uploads when retrying a failed upload or save.
      for (const file of input.images === undefined ? [] : files) {
        paths.push(await uploadRoomTypeImage(file))
        setImages([...paths])
        setFiles((previous) => previous.filter((item) => item !== file))
      }
      const payload = input.images === undefined ? input : { ...input, images: paths }
      return initial
        ? updateRoomType(initial.id, payload)
        : createRoomType(payload as RoomTypeInput)
    },
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
      else {
        const raw = axios.isAxiosError(error) ? error.response?.data?.message : undefined
        const messages: string[] = Array.isArray(raw) ? raw : [message]
        const fieldErrors = Object.fromEntries(
          ['adultCapacity', 'childCapacity'].flatMap((field) => {
            const matched = messages.filter((text) => text.includes(field))
            return matched.length ? [[field, matched.join(', ')]] : []
          }),
        )
        if (Object.keys(fieldErrors).length) setErrors(fieldErrors)
        else setGeneral(message)
      }
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
    if (
      !adultCapacity.trim() ||
      !Number.isSafeInteger(Number(adultCapacity)) ||
      Number(adultCapacity) < 1
    )
      next.adultCapacity = 'Số người lớn phải là số nguyên từ 1.'
    if (
      !childCapacity.trim() ||
      !Number.isSafeInteger(Number(childCapacity)) ||
      Number(childCapacity) < 0
    )
      next.childCapacity = 'Số trẻ em phải là số nguyên từ 0.'
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
      ...(images.length || initial?.images !== undefined || files.length ? { images } : {}),
      name: name.trim(),
      description: description.trim(),
      adultCapacity: Number(adultCapacity),
      childCapacity: Number(childCapacity),
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
    if (files.length) changes.images = images
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
      <fieldset
        disabled={mutation.isPending}
        className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <TextField
            label="Tên loại phòng"
            required
            maxLength={100}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
          />
        </div>
        <div className="sm:col-span-2">
          <TextField
            label="Mô tả"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-3 rounded-xl border border-stone-300 bg-cream-100/40 p-4 sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Ảnh loại phòng</p>
            <span className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs">
              {images.length + files.length} / 10 ảnh
            </span>
          </div>
          <input
            id="room-type-images"
            aria-label="Ảnh loại phòng"
            className="peer sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            aria-describedby="room-type-images-help"
            onChange={(event) => {
              const added = Array.from(event.target.files ?? [])
              event.target.value = ''
              if (images.length + files.length + added.length > 10) {
                setGeneral('Mỗi loại phòng có tối đa 10 ảnh.')
                return
              }
              if (
                added.some(
                  (file) =>
                    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
                    file.size === 0 ||
                    file.size > 5 * 1024 * 1024,
                )
              ) {
                setGeneral('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh.')
                return
              }
              setGeneral('')
              const addedPreviews = added.map((file) => {
                const url = URL.createObjectURL(file)
                generatedUrls.current.push(url)
                return [file, url] as const
              })
              setPreviewUrls((previous) => new Map([...previous, ...addedPreviews]))
              setFiles((previous) => [...previous, ...added])
            }}
          />
          <label
            htmlFor="room-type-images"
            className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-white px-4 py-5 text-center transition hover:border-primary hover:bg-cream-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-wait peer-disabled:opacity-50"
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-cream-100 text-2xl text-primary"
            >
              +
            </span>
            <span className="text-sm font-semibold text-primary">Chọn ảnh từ thiết bị</span>
            <span className="text-xs text-stone-600">Có thể chọn nhiều ảnh cùng lúc</span>
          </label>
          <p id="room-type-images-help" className="text-xs">
            Tối đa 10 ảnh JPG, PNG hoặc WebP, mỗi ảnh tối đa 5 MB. Ảnh đầu tiên là ảnh đại diện.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((path, index) => (
              <div
                key={path}
                className="min-w-0 overflow-hidden rounded-lg border border-stone-300 bg-white shadow-sm"
              >
                <button
                  type="button"
                  aria-label={`Phóng to ảnh ${index + 1}`}
                  onClick={() => setViewing(index)}
                  className="group block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <AssetImage
                    path={path}
                    name={`Ảnh ${index + 1}`}
                    className="aspect-[4/3] w-full object-cover transition group-hover:scale-105"
                  />
                </button>
                <button
                  type="button"
                  className="min-h-11 w-full px-2 text-xs text-primary transition hover:bg-cream-100"
                  onClick={() => setImages((previous) => previous.filter((_, i) => i !== index))}
                >
                  Bỏ ảnh {index + 1}
                </button>
              </div>
            ))}
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="min-w-0 overflow-hidden rounded-lg border border-stone-300 bg-white shadow-sm"
              >
                <button
                  type="button"
                  aria-label={`Phóng to ${file.name}`}
                  onClick={() => setViewing(images.length + index)}
                  className="group block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {previewUrls.get(file) && (
                    <img
                      src={previewUrls.get(file)}
                      alt={file.name}
                      className="aspect-[4/3] w-full object-cover transition group-hover:scale-105"
                    />
                  )}
                </button>
                <button
                  type="button"
                  className="min-h-11 w-full truncate px-2 text-xs text-primary transition hover:bg-cream-100"
                  onClick={() => setFiles((previous) => previous.filter((_, i) => i !== index))}
                >
                  Bỏ {file.name}
                </button>
              </div>
            ))}
          </div>
        </div>
        <TextField
          label="Người lớn"
          required
          type="number"
          min={1}
          step={1}
          value={adultCapacity}
          onChange={(event) => setAdultCapacity(event.target.value)}
          error={errors.adultCapacity}
        />
        <TextField
          label="Trẻ em"
          required
          type="number"
          min={0}
          step={1}
          value={childCapacity}
          onChange={(event) => setChildCapacity(event.target.value)}
          error={errors.childCapacity}
        />
        <div className="sm:col-span-2">
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
        </div>
        <fieldset
          tabIndex={-1}
          aria-invalid={errors.amenities ? true : undefined}
          aria-describedby={errors.amenities ? 'amenities-error' : undefined}
          className="grid grid-cols-1 gap-x-4 rounded-xl border border-stone-300 p-4 sm:col-span-2 sm:grid-cols-2"
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
      <div className="flex flex-wrap gap-3 border-t border-stone-300 pt-5">
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
      {viewing !== null && (
        <ImageLightbox
          images={[
            ...images.map((path) => assetUrl(path)!),
            ...files.map((file) => previewUrls.get(file)!),
          ]}
          name={name || 'Ảnh loại phòng'}
          startIndex={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </form>
  )
}
