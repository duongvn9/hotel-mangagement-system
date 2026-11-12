import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Alert, FormField } from '@/components/molecules'
import { Button, Input, Label, NativeSelect, Textarea } from '@/components/atoms'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { AssetImage } from '@/components/AssetImage'
import { ImageLightbox } from '@/components/ImageLightbox'
import { assetUrl } from '@/lib/asset-url'
import {
  createRoomType,
  getAmenityOptions,
  getBedTypeOptions,
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
  const dialog = useRef<HTMLDivElement>(null)
  const previous = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )
  const query = useQuery({
    queryKey: ['room-type', id],
    queryFn: () => getRoomType(id!),
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
          if (busy() || document.querySelector('dialog[open]')) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          previous.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{id ? 'Sửa loại phòng' : 'Thêm loại phòng'}</DialogTitle>
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
          <RoomTypeForm
            initial={id ? query.data : undefined}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
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
  const bedOptions = useQuery({ queryKey: ['bed-type-options'], queryFn: getBedTypeOptions })
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [adultCapacity, setAdultCapacity] = useState(String(initial?.adultCapacity ?? ''))
  const [childCapacity, setChildCapacity] = useState(String(initial?.childCapacity ?? ''))
  const [price, setPrice] = useState(
    initial ? new Intl.NumberFormat('vi-VN').format(initial.basePrice) : '',
  )
  const [selected, setSelected] = useState(initial?.amenities.map((a) => a.id) ?? [])
  const [beds, setBeds] = useState<{ bedTypeId: string; quantity: number }[]>(
    initial?.beds.map((bed) => ({ bedTypeId: bed.bedTypeId, quantity: bed.quantity })) ?? [],
  )
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
  const [confirmationMode, setConfirmationMode] = useState<'deactivate' | 'save' | null>(null)
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
      else if (/giường/i.test(message)) setErrors({ beds: message })
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
  function save(event?: FormEvent, deactivate = false, confirmed = false) {
    event?.preventDefault()
    if (locked.current) return
    setGeneral('')
    if (deactivate) {
      if (!confirmed) {
        setConfirmationMode('deactivate')
        return
      }
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
    if (beds.some((bed) => !bed.bedTypeId)) next.beds = 'Chọn loại giường cho mỗi dòng đã thêm.'
    else if (
      beds.some(
        (bed) => !Number.isSafeInteger(bed.quantity) || bed.quantity < 1 || bed.quantity > 20,
      )
    )
      next.beds = 'Số lượng mỗi loại giường phải từ 1 đến 20.'
    else if (new Set(beds.map((bed) => bed.bedTypeId)).size !== beds.length)
      next.beds = 'Mỗi loại giường chỉ chọn một lần.'
    setErrors(next)
    if (Object.keys(next).length) {
      focusError()
      return
    }
    const isActive = deactivate ? false : active
    if (initial?.isActive && !isActive && !confirmed) {
      setConfirmationMode('save')
      return
    }
    const input: RoomTypeInput = {
      ...(images.length || initial?.images !== undefined || files.length ? { images } : {}),
      name: name.trim(),
      description: description.trim(),
      adultCapacity: Number(adultCapacity),
      childCapacity: Number(childCapacity),
      basePrice: amount,
      amenities: selected,
      beds,
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
                  : key === 'beds'
                    ? initial.beds.map((bed) => ({
                        bedTypeId: bed.bedTypeId,
                        quantity: bed.quantity,
                      }))
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
  // Active bed types, plus any already-attached type that has since been deactivated.
  const bedList = Array.isArray(bedOptions.data) ? bedOptions.data : []
  const bedChoices = [
    ...bedList,
    ...(initial?.beds ?? [])
      .filter((bed) => !bedList.some((option) => option.id === bed.bedTypeId))
      .map((bed) => ({ id: bed.bedTypeId, name: `${bed.bedTypeName} (ngừng)` })),
  ]
  const usedBedIds = new Set(beds.map((bed) => bed.bedTypeId))
  const addableBed = bedChoices.find((choice) => !usedBedIds.has(choice.id))
  const addBed = () => {
    if (addableBed) setBeds((previous) => [...previous, { bedTypeId: addableBed.id, quantity: 1 }])
  }
  const removeBed = (index: number) => setBeds((previous) => previous.filter((_, i) => i !== index))
  const changeBedType = (index: number, bedTypeId: string) =>
    setBeds((previous) => previous.map((bed, i) => (i === index ? { ...bed, bedTypeId } : bed)))
  const changeBedQty = (index: number, value: string) =>
    setBeds((previous) =>
      previous.map((bed, i) => (i === index ? { ...bed, quantity: Number(value) } : bed)),
    )
  return (
    <form
      ref={form}
      noValidate
      onSubmit={save}
      className="space-y-4 py-2"
      aria-busy={mutation.isPending}
    >
      {general && <Alert tone="danger">{general}</Alert>}
      <fieldset disabled={mutation.isPending} className="grid min-w-0 grid-cols-1 gap-4">
        <div className="min-w-0">
          <FormField label="Tên loại phòng" htmlFor="room-type-name" required error={errors.name}>
            <Input
              id="room-type-name"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'room-type-name-error' : undefined}
              required
              maxLength={100}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
        </div>
        <div className="min-w-0">
          <FormField
            label="Giá VND"
            htmlFor="room-type-basePrice"
            required
            error={errors.basePrice}
          >
            <Input
              id="room-type-basePrice"
              aria-invalid={errors.basePrice ? true : undefined}
              aria-describedby={errors.basePrice ? 'room-type-basePrice-error' : undefined}
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
            />
          </FormField>
        </div>
        <FormField
          label="Người lớn"
          htmlFor="room-type-adultCapacity"
          required
          error={errors.adultCapacity}
        >
          <Input
            id="room-type-adultCapacity"
            aria-invalid={errors.adultCapacity ? true : undefined}
            aria-describedby={errors.adultCapacity ? 'room-type-adultCapacity-error' : undefined}
            required
            type="number"
            min={1}
            step={1}
            value={adultCapacity}
            onChange={(event) => setAdultCapacity(event.target.value)}
          />
        </FormField>
        <FormField
          label="Trẻ em"
          htmlFor="room-type-childCapacity"
          required
          error={errors.childCapacity}
        >
          <Input
            id="room-type-childCapacity"
            aria-invalid={errors.childCapacity ? true : undefined}
            aria-describedby={errors.childCapacity ? 'room-type-childCapacity-error' : undefined}
            required
            type="number"
            min={0}
            step={1}
            value={childCapacity}
            onChange={(event) => setChildCapacity(event.target.value)}
          />
        </FormField>
        <div className="min-w-0">
          <FormField label="Mô tả" htmlFor="room-type-description">
            <Textarea
              id="room-type-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
        </div>
        <div className="min-w-0 space-y-3 rounded-xl border border-border bg-surface/40 p-4 ">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Ảnh loại phòng</p>
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs">
              {images.length + files.length} / 10 ảnh
            </span>
          </div>
          <Input
            id="room-type-images"
            aria-label="Ảnh loại phòng"
            className="peer sr-only size-px border-0 p-0"
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
          <Label
            htmlFor="room-type-images"
            className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-card px-4 py-5 text-center transition hover:border-primary hover:bg-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-wait peer-disabled:opacity-50"
          >
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-full bg-surface text-2xl text-primary"
            >
              +
            </span>
            <span className="text-sm font-semibold text-primary">Chọn ảnh từ thiết bị</span>
            <span className="text-xs text-muted-foreground">Có thể chọn nhiều ảnh cùng lúc</span>
          </Label>
          <p id="room-type-images-help" className="text-xs">
            Tối đa 10 ảnh JPG, PNG hoặc WebP, mỗi ảnh tối đa 5 MB. Ảnh đầu tiên là ảnh đại diện.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((path, index) => (
              <div
                key={path}
                className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm"
              >
                <Button
                  variant="ghost"
                  type="button"
                  aria-label={`Phóng to ảnh ${index + 1}`}
                  onClick={() => setViewing(index)}
                  className="group block h-auto w-full overflow-hidden rounded-none p-0 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <AssetImage
                    path={path}
                    name={`Ảnh ${index + 1}`}
                    className="aspect-[4/3] w-full object-cover transition group-hover:scale-105"
                  />
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className="min-h-11 w-full rounded-none px-2 text-xs text-primary transition hover:bg-surface"
                  onClick={() => setImages((previous) => previous.filter((_, i) => i !== index))}
                >
                  Bỏ ảnh {index + 1}
                </Button>
              </div>
            ))}
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm"
              >
                <Button
                  variant="ghost"
                  type="button"
                  aria-label={`Phóng to ${file.name}`}
                  onClick={() => setViewing(images.length + index)}
                  className="group block h-auto w-full overflow-hidden rounded-none p-0 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {previewUrls.get(file) && (
                    <img
                      src={previewUrls.get(file)}
                      alt={file.name}
                      className="aspect-[4/3] w-full object-cover transition group-hover:scale-105"
                    />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className="min-h-11 w-full min-w-0 truncate rounded-none px-2 text-xs text-primary transition hover:bg-surface"
                  onClick={() => setFiles((previous) => previous.filter((_, i) => i !== index))}
                >
                  Bỏ {file.name}
                </Button>
              </div>
            ))}
          </div>
        </div>
        <fieldset
          tabIndex={-1}
          aria-invalid={errors.amenities ? true : undefined}
          aria-describedby={errors.amenities ? 'amenities-error' : undefined}
          className="grid grid-cols-1 gap-x-4 rounded-xl border border-border p-4  sm:grid-cols-2"
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
            <Label key={option.id} className="flex min-h-11 items-center gap-3 text-sm">
              <Input
                type="checkbox"
                className="size-4 shrink-0"
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
              <span className="min-w-0 break-words">{option.name}</span>
            </Label>
          ))}
          {errors.amenities && (
            <p id="amenities-error" className="text-sm text-danger">
              {errors.amenities}
            </p>
          )}
        </fieldset>
        <fieldset
          tabIndex={-1}
          aria-invalid={errors.beds ? true : undefined}
          aria-describedby={errors.beds ? 'beds-error' : undefined}
          className="min-w-0 space-y-3 rounded-xl border border-border p-4"
        >
          <legend className="text-sm font-semibold">Cấu hình giường</legend>
          {bedOptions.isPending && <p role="status">Đang tải loại giường…</p>}
          {bedOptions.isError && (
            <>
              <Alert tone="danger">{getErrorMessage(bedOptions.error)}</Alert>
              <Button
                type="button"
                disabled={bedOptions.isFetching}
                onClick={() => void bedOptions.refetch()}
              >
                Thử lại loại giường
              </Button>
            </>
          )}
          {beds.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Chưa thêm giường nào cho loại phòng này.
            </p>
          )}
          {beds.map((bed, index) => {
            const taken = new Set(
              beds.filter((_, i) => i !== index).map((other) => other.bedTypeId),
            )
            return (
              <div key={index} className="flex flex-wrap items-end gap-3">
                <div className="min-w-40 flex-1">
                  <Label htmlFor={`room-type-bed-${index}`} className="text-sm">
                    Loại giường
                  </Label>
                  <NativeSelect
                    id={`room-type-bed-${index}`}
                    value={bed.bedTypeId}
                    onChange={(event) => changeBedType(index, event.target.value)}
                  >
                    <option value="">— Chọn loại giường —</option>
                    {bedChoices
                      .filter((choice) => choice.id === bed.bedTypeId || !taken.has(choice.id))
                      .map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.name}
                        </option>
                      ))}
                  </NativeSelect>
                </div>
                <div className="w-24">
                  <Label htmlFor={`room-type-bed-qty-${index}`} className="text-sm">
                    Số lượng
                  </Label>
                  <Input
                    id={`room-type-bed-qty-${index}`}
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={bed.quantity}
                    onChange={(event) => changeBedQty(index, event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Bỏ giường ${index + 1}`}
                  onClick={() => removeBed(index)}
                >
                  Bỏ
                </Button>
              </div>
            )
          })}
          <Button type="button" variant="outline" disabled={!addableBed} onClick={addBed}>
            Thêm giường
          </Button>
          {errors.beds && (
            <p id="beds-error" role="alert" className="text-sm text-danger">
              {errors.beds}
            </p>
          )}
        </fieldset>
        <Label className="flex min-h-11 items-center gap-3 text-sm">
          <Input
            type="checkbox"
            className="size-4 shrink-0"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Kích hoạt
        </Label>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button
          type="submit"
          disabled={mutation.isPending}
          aria-busy={mutation.isPending || undefined}
        >
          {mutation.isPending ? 'Đang xử lý…' : 'Lưu loại phòng'}
        </Button>
        {initial?.isActive && (
          <Button
            type="button"
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => save(undefined, true)}
          >
            Ngừng nhận đặt phòng
          </Button>
        )}
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
          Hủy
        </Button>
      </div>
      <AlertDialog
        open={confirmationMode !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmationMode(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ngừng nhận đặt phòng?</AlertDialogTitle>
            <AlertDialogDescription>{confirmation}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => save(undefined, confirmationMode === 'deactivate', true)}
            >
              Ngừng nhận đặt phòng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
