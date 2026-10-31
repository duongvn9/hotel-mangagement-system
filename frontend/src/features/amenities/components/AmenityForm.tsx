import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { ImagePicker } from '@/components/ImagePicker'
import { assetUrl } from '@/lib/asset-url'
import {
  createAmenity,
  getAmenity,
  updateAmenity,
  uploadAmenityImage,
  amenityRoomTypeOptions,
  type Amenity,
  type AmenityInput,
} from '../api'

export function AmenityEditor({
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
    queryKey: ['amenity', id],
    queryFn: () => getAmenity(id!),
    enabled: id !== null,
  })
  useLayoutEffect(() => {
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
      aria-labelledby="amenity-form-title"
      className="m-auto max-h-[92dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-stone-300 bg-white p-5 font-body text-pearl-900 shadow-xl backdrop:bg-pearl-900/60 sm:p-8"
      onCancel={(event) => {
        event.preventDefault()
        if (!dialog.current?.querySelector('[aria-busy="true"]')) onClose()
      }}
    >
      <h2 id="amenity-form-title" className="mb-6 font-display text-3xl">
        {id ? 'Sửa tiện nghi' : 'Thêm tiện nghi'}
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
        <AmenityForm
          initial={id ? query.data : undefined}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </dialog>
  )
}
const deactivate =
  'Tiện nghi được giữ lại cùng các gắn kết hiện có, nhưng không thể gắn mới. Bạn muốn ngừng tiện nghi này?'
const reactivate = 'Bạn muốn kích hoạt lại tiện nghi này để có thể gắn mới vào loại phòng?'
export function AmenityForm({
  initial,
  onClose,
  onSuccess,
}: {
  initial?: Amenity
  onClose: () => void
  onSuccess: () => void
}) {
  const form = useRef<HTMLFormElement>(null)
  const locked = useRef(false)
  const id = useId()
  const client = useQueryClient()
  const options = useQuery({ queryKey: ['room-types', 'options'], queryFn: amenityRoomTypeOptions })
  const originalIds = initial?.roomTypes.map((type) => type.id) ?? []
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [selected, setSelected] = useState(originalIds)
  const [active, setActive] = useState(initial?.isActive ?? true)
  const originalImages = initial?.images?.length
    ? initial.images
    : initial?.iconUrl
      ? [initial.iconUrl]
      : []
  const [images, setImages] = useState<string[]>(originalImages.slice(0, 1))
  const [files, setFiles] = useState<{ file: File; src: string }[]>([])
  const generatedUrls = useRef<string[]>([])
  useEffect(() => {
    const urls = generatedUrls.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const choices = [
    ...(options.data ?? []).map((type) => ({ ...type, isActive: true })),
    ...(initial?.roomTypes.filter(
      (type) => !options.data?.some((option) => option.id === type.id),
    ) ?? []),
  ]
  const focusError = () =>
    window.setTimeout(
      () => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      0,
    )
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [])
  const mutation = useMutation({
    mutationFn: async (input: Partial<AmenityInput>) => {
      const paths = [...(input.images ?? [])]
      for (const item of input.images === undefined ? [] : files) {
        paths.push(await uploadAmenityImage(item.file))
        setImages([...paths])
        setFiles((previous) => previous.filter((file) => file !== item))
      }
      const payload = input.images === undefined ? input : { ...input, images: paths }
      return initial ? updateAmenity(initial.id, payload) : createAmenity(payload as AmenityInput)
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['amenities'] }),
        client.invalidateQueries({ queryKey: ['amenity', initial?.id] }),
        client.invalidateQueries({ queryKey: ['amenity-options'] }),
        client.invalidateQueries({ queryKey: ['room-types'] }),
        client.invalidateQueries({ queryKey: ['room-type'] }),
      ])
      onSuccess()
    },
    onError: (error) => {
      const message = getErrorMessage(error)
      if (axios.isAxiosError(error) && error.response?.status === 409 && /tên|name/i.test(message))
        setErrors({ name: message })
      else if (/roomTypeIds|Room Type|loại phòng/i.test(message)) {
        let readable = message
        for (const type of choices)
          readable = readable.replaceAll(type.id, type.name + (type.isActive ? '' : ' (ngừng)'))
        setErrors({ roomTypeIds: readable })
      } else {
        const raw = axios.isAxiosError(error) ? error.response?.data?.message : undefined
        const messages: string[] = Array.isArray(raw) ? raw : [message]
        const fields = Object.fromEntries(
          ['name', 'description', 'isActive'].flatMap((field) => {
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
    setErrors({})
    if (toggle && initial) {
      if (!window.confirm(initial.isActive ? deactivate : reactivate)) return
      locked.current = true
      mutation.mutate({ isActive: !initial.isActive })
      return
    }
    const next: Record<string, string> = {}
    if (!name.trim() || name.trim().length > 100)
      next.name = 'Nhập tên tiện nghi (tối đa 100 ký tự).'
    const added = selected.filter((type) => !originalIds.includes(type))
    if (added.length && !active)
      next.roomTypeIds = 'Tiện nghi đang ngừng không thể gắn mới; bật lại hoặc bỏ các lựa chọn mới.'
    else if (added.some((type) => !options.data?.some((option) => option.id === type)))
      next.roomTypeIds = 'Chọn loại phòng còn hoạt động; tải lại danh sách nếu cần.'
    setErrors(next)
    if (Object.keys(next).length) {
      focusError()
      return
    }
    if (initial && active !== initial.isActive && !window.confirm(active ? reactivate : deactivate))
      return
    const input: AmenityInput = {
      ...(images.length || originalImages.length || files.length ? { images } : {}),
      name: name.trim(),
      description: description.trim(),
      isActive: active,
      roomTypeIds: selected,
    }
    const changes: Partial<AmenityInput> = initial
      ? {
          ...(JSON.stringify(images) !== JSON.stringify(originalImages) || files.length
            ? { images }
            : {}),
          ...(input.name === initial.name ? {} : { name: input.name }),
          ...(input.description === initial.description ? {} : { description: input.description }),
          ...(input.isActive === initial.isActive ? {} : { isActive: input.isActive }),
          ...(selected.length === originalIds.length &&
          selected.every((type) => originalIds.includes(type))
            ? {}
            : { roomTypeIds: selected }),
        }
      : input
    if (!Object.keys(changes).length) {
      onClose()
      return
    }
    locked.current = true
    mutation.mutate(changes)
  }
  return (
    <form
      ref={form}
      noValidate
      onSubmit={save}
      aria-busy={mutation.isPending}
      className="space-y-4"
    >
      {general && <Alert tone="danger">{general}</Alert>}
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-5">
        <TextField
          label="Tên tiện nghi"
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />
        <div>
          <label
            htmlFor={id + '-description'}
            className="mb-2 block text-xs font-semibold tracking-wider text-stone-700 uppercase"
          >
            Mô tả
          </label>
          <textarea
            id={id + '-description'}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? id + '-description-error' : undefined}
            className="min-h-11 w-full rounded border border-stone-300 bg-white px-4 py-3 text-sm hover:border-stone-500 focus:border-primary disabled:bg-stone-200"
          />
          {errors.description && (
            <p id={id + '-description-error'} className="text-xs text-danger">
              {errors.description}
            </p>
          )}
        </div>
        <ImagePicker
          name={name}
          images={[
            ...images.map((path, index) => ({ src: assetUrl(path)!, label: `Ảnh ${index + 1}` })),
            ...files.map((item) => ({ src: item.src, label: item.file.name })),
          ]}
          onChoose={(added) => {
            if (!added.length) return
            if (added.length > 1) {
              setGeneral('Mỗi tiện nghi chỉ được chọn 1 ảnh.')
              return
            }
            if (
              added.some(
                (file) =>
                  !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
                  !file.size ||
                  file.size > 5 * 1024 * 1024,
              )
            ) {
              setGeneral('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh.')
              return
            }
            setGeneral('')
            const selectedFiles = added.map((file) => {
              const src = URL.createObjectURL(file)
              generatedUrls.current.push(src)
              return { file, src }
            })
            setImages([])
            setFiles(selectedFiles)
          }}
          onRemove={(index) =>
            index < images.length
              ? setImages((previous) => previous.filter((_, i) => i !== index))
              : setFiles((previous) => previous.filter((_, i) => i !== index - images.length))
          }
        />
        <fieldset
          tabIndex={-1}
          aria-invalid={errors.roomTypeIds ? true : undefined}
          aria-describedby={errors.roomTypeIds ? id + '-types-error' : undefined}
          className="space-y-3 rounded-xl border border-stone-300 p-4"
        >
          <legend className="text-sm font-semibold">Gắn vào Room Type</legend>
          <TextField
            label="Tìm loại phòng"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {options.isPending && <p role="status">Đang tải loại phòng…</p>}
          {options.isError && (
            <>
              <Alert tone="danger">{getErrorMessage(options.error)}</Alert>
              <Button
                type="button"
                disabled={options.isFetching}
                onClick={() => void options.refetch()}
              >
                Thử lại loại phòng
              </Button>
            </>
          )}
          {options.isSuccess && !choices.length && <p>Chưa có Room Type nào</p>}
          {!active && (
            <p className="text-sm text-stone-700">
              Tiện nghi đang ngừng: bật lại để gắn thêm loại phòng. Bạn vẫn có thể gỡ gắn kết cũ.
            </p>
          )}
          <p className="text-sm text-stone-700">Đã chọn {selected.length} loại phòng</p>
          <div className="grid max-h-64 grid-cols-1 gap-x-4 overflow-y-auto sm:grid-cols-2">
            {choices
              .filter((type) =>
                type.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
              )
              .map((type) => (
                <label key={type.id} className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(type.id)}
                    disabled={
                      !selected.includes(type.id) &&
                      ((!active && !originalIds.includes(type.id)) ||
                        (!type.isActive && !originalIds.includes(type.id)) ||
                        (options.isPending && !originalIds.includes(type.id)) ||
                        (options.isError && !originalIds.includes(type.id)))
                    }
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked
                          ? [...previous, type.id]
                          : previous.filter((value) => value !== type.id),
                      )
                    }
                  />
                  {type.name}
                  {type.isActive ? '' : ' (ngừng)'}
                </label>
              ))}
            {choices.length > 0 &&
              !choices.some((type) =>
                type.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
              ) && <p>Không có loại phòng khớp tìm kiếm.</p>}
          </div>
          {errors.roomTypeIds && (
            <p id={id + '-types-error'} className="text-sm text-danger">
              {errors.roomTypeIds}
            </p>
          )}
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            aria-invalid={errors.isActive ? true : undefined}
            aria-describedby={errors.isActive ? id + '-active-error' : undefined}
          />
          Đang hoạt động
        </label>
        {errors.isActive && (
          <p id={id + '-active-error'} className="text-xs text-danger">
            {errors.isActive}
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-3 border-t border-stone-300 pt-5">
        <Button type="submit" loading={mutation.isPending}>
          Lưu tiện nghi
        </Button>
        {initial && (
          <Button
            type="button"
            variant={initial.isActive ? 'danger' : 'secondary'}
            disabled={mutation.isPending}
            onClick={() => save(undefined, true)}
          >
            {initial.isActive ? 'Ngừng tiện nghi' : 'Kích hoạt lại tiện nghi'}
          </Button>
        )}
        <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onClose}>
          Hủy
        </Button>
      </div>
    </form>
  )
}
