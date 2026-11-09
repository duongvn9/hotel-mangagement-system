import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button, Input, Label, Textarea, Checkbox } from '@/components/atoms'
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
import { ImagePicker } from '@/components/ImagePicker'
import { assetUrl } from '@/lib/asset-url'
import {
  createService,
  getService,
  updateService,
  uploadServiceImage,
  type Service,
  type ServiceInput,
} from '../api'

export function ServiceEditor({
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
    queryKey: ['service', id],
    queryFn: () => getService(id!),
    enabled: id !== null,
    refetchOnWindowFocus: false,
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
          <DialogTitle>{id ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}</DialogTitle>
        </DialogHeader>
        {id && !query.data && query.isPending ? (
          <>
            <p role="status">Đang tải chi tiết…</p>
            <Button onClick={onClose}>Đóng</Button>
          </>
        ) : id && !query.data && query.isError ? (
          <>
            <Alert tone="danger">{getErrorMessage(query.error)}</Alert>
            <Button onClick={() => void query.refetch()}>Thử lại</Button>
            <Button onClick={onClose}>Đóng</Button>
          </>
        ) : (
          <ServiceForm
            initial={id ? query.data : undefined}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
const vnd = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
function parsePrice(text: string): number | null | undefined {
  const value = text.trim()
  if (!value) return null
  if (!/^(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(value)) return undefined
  const amount = Number(value.replaceAll('.', ''))
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : undefined
}
const deactivate =
  'Dịch vụ được giữ lại và không còn được chào cho khách đặt mới; các yêu cầu dịch vụ đã có không bị ảnh hưởng. Bạn muốn ngừng dịch vụ này?'
const reactivate = 'Bạn muốn kích hoạt lại dịch vụ này để khách có thể đặt mới?'
export function ServiceForm({
  initial: initialProp,
  onClose,
  onSuccess,
}: {
  initial?: Service
  onClose: () => void
  onSuccess: () => void
}) {
  const [initial, setInitial] = useState(initialProp)
  const [name, setName] = useState(initialProp?.name ?? '')
  const [description, setDescription] = useState(initialProp?.description ?? '')
  const [unit, setUnit] = useState(initialProp?.unit ?? '')
  const [billable, setBillable] = useState(initialProp?.billable ?? true)
  const [price, setPrice] = useState(
    initialProp?.price == null ? '' : vnd.format(initialProp.price),
  )
  const [active, setActive] = useState(initialProp?.isActive ?? true)
  const [imageUrl, setImageUrl] = useState(initialProp?.imageUrl ?? '')
  const [imageFile, setImageFile] = useState<{ file: File; src: string } | null>(null)
  const generatedUrls = useRef<string[]>([])
  useEffect(() => {
    const urls = generatedUrls.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [conflict, setConflict] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [confirmation, setConfirmation] = useState<'reload' | 'toggle' | 'save' | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const locked = useRef(false)
  const client = useQueryClient()
  const id = useId()
  const focusError = () =>
    window.setTimeout(
      () => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      0,
    )
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [])
  const mutation = useMutation({
    mutationFn: async (input: Partial<ServiceInput>) => {
      let payload = input
      if (input.imageUrl !== undefined && imageFile) {
        const path = await uploadServiceImage(imageFile.file)
        setImageUrl(path)
        setImageFile(null)
        payload = { ...input, imageUrl: path }
      }
      return initial ? updateService(initial.id, payload) : createService(payload as ServiceInput)
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['services'] }),
        client.invalidateQueries({ queryKey: ['service'] }),
      ])
      onSuccess()
    },
    onError: (error) => {
      const message = getErrorMessage(error)
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 409 &&
        /thay đổi|tải lại/i.test(message)
      ) {
        setConflict(true)
        setGeneral(
          message + ' Nội dung đã nhập vẫn được giữ. Chọn Tải lại dữ liệu để lấy bản mới nhất.',
        )
      } else if (
        axios.isAxiosError(error) &&
        error.response?.status === 409 &&
        /tên|name/i.test(message)
      )
        setErrors({ name: message })
      else if (/price|giá/i.test(message)) setErrors({ price: message })
      else {
        const raw = axios.isAxiosError(error) ? error.response?.data?.message : undefined
        const messages: string[] = Array.isArray(raw) ? raw : [message]
        const fields = Object.fromEntries(
          ['name', 'description', 'unit', 'billable', 'isActive'].flatMap((field) => {
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
  const busy = mutation.isPending || reloading
  async function reload() {
    if (!initial || locked.current) return
    locked.current = true
    setReloading(true)
    try {
      const fresh = await getService(initial.id)
      setInitial(fresh)
      setName(fresh.name)
      setDescription(fresh.description)
      setUnit(fresh.unit)
      setBillable(fresh.billable)
      setPrice(fresh.price == null ? '' : vnd.format(fresh.price))
      setActive(fresh.isActive)
      setImageUrl(fresh.imageUrl ?? '')
      setImageFile(null)
      client.setQueryData(['service', fresh.id], fresh)
      setErrors({})
      setGeneral('')
      setConflict(false)
      mutation.reset()
      window.setTimeout(() => form.current?.querySelector<HTMLInputElement>('input')?.focus(), 0)
    } catch (error) {
      setGeneral(getErrorMessage(error))
    } finally {
      setReloading(false)
      locked.current = false
    }
  }
  function save(event?: FormEvent, toggle = false, confirmed = false) {
    event?.preventDefault()
    if (locked.current) return
    setGeneral('')
    setErrors({})
    setConflict(false)
    if (toggle && initial) {
      if (!confirmed) {
        setConfirmation('toggle')
        return
      }
      locked.current = true
      mutation.mutate({ isActive: !initial.isActive })
      return
    }
    const next: Record<string, string> = {}
    const amount = parsePrice(price)
    if (!name.trim() || name.trim().length > 100) next.name = 'Nhập tên dịch vụ (tối đa 100 ký tự).'
    if (amount === undefined)
      next.price = 'Giá phải là số nguyên VND không âm trong giới hạn an toàn.'
    else if (billable && active && amount === null)
      next.price = 'Cần giá hợp lệ để kích hoạt dịch vụ tính phí.'
    setErrors(next)
    if (Object.keys(next).length) {
      focusError()
      return
    }
    if (initial && active !== initial.isActive && !confirmed) {
      setConfirmation('save')
      return
    }
    const input: ServiceInput = {
      ...(imageUrl || initial?.imageUrl || imageFile ? { imageUrl } : {}),
      name: name.trim(),
      description: description.trim(),
      unit: unit.trim(),
      billable,
      price: amount ?? null,
      isActive: active,
    }
    const changes: Partial<ServiceInput> = initial
      ? Object.fromEntries(
          Object.entries(input).filter(([key, value]) => value !== initial[key as keyof Service]),
        )
      : input
    if (imageFile) changes.imageUrl = imageUrl
    if (!Object.keys(changes).length) {
      onClose()
      return
    }
    locked.current = true
    mutation.mutate(changes)
  }
  return (
    <form ref={form} noValidate onSubmit={save} aria-busy={busy} className="space-y-4 py-2">
      {general && <Alert tone="danger">{general}</Alert>}
      {conflict && initial && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setConfirmation('reload')}
        >
          Tải lại dữ liệu
        </Button>
      )}
      {reloading && <p role="status">Đang tải lại dữ liệu…</p>}
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <FormField label="Tên dịch vụ" htmlFor={id + '-name'} error={errors.name} required>
          <Input
            id={id + '-name'}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? id + '-name-error' : undefined}
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <div>
          <Label htmlFor={id + '-description'} className="mb-1.5 block">
            Mô tả
          </Label>
          <Textarea
            id={id + '-description'}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? id + '-description-error' : undefined}
            className="resize-y"
          />
          {errors.description && (
            <p id={id + '-description-error'} className="text-xs text-danger">
              {errors.description}
            </p>
          )}
        </div>
        <ImagePicker
          appearance="prototype"
          label="Ảnh dịch vụ"
          name={name}
          images={
            imageFile
              ? [{ src: imageFile.src, label: imageFile.file.name }]
              : imageUrl
                ? [{ src: assetUrl(imageUrl)!, label: name || 'Ảnh dịch vụ' }]
                : []
          }
          onChoose={(files) => {
            if (!files.length) return
            if (files.length > 1) {
              setGeneral('Mỗi dịch vụ chỉ được chọn 1 ảnh.')
              return
            }
            const file = files[0]
            if (
              !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
              !file.size ||
              file.size > 5 * 1024 * 1024
            ) {
              setGeneral('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh.')
              return
            }
            const src = URL.createObjectURL(file)
            generatedUrls.current.push(src)
            setImageUrl('')
            setImageFile({ file, src })
            setGeneral('')
          }}
          onRemove={() => {
            setImageUrl('')
            setImageFile(null)
          }}
        />
        <FormField label="Đơn vị (tùy chọn)" htmlFor={id + '-unit'} error={errors.unit}>
          <Input
            id={id + '-unit'}
            aria-invalid={errors.unit ? true : undefined}
            aria-describedby={errors.unit ? id + '-unit-error' : undefined}
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />
        </FormField>
        <Label htmlFor={id + '-billable'} className="flex min-h-11 items-center gap-3 text-sm">
          <Checkbox
            id={id + '-billable'}
            checked={billable}
            onCheckedChange={(checked) => setBillable(checked === true)}
            aria-invalid={errors.billable ? true : undefined}
            aria-describedby={errors.billable ? id + '-billable-error' : undefined}
          />
          Tính phí
        </Label>
        {errors.billable && (
          <p id={id + '-billable-error'} className="text-xs text-danger">
            {errors.billable}
          </p>
        )}
        <FormField
          label="Giá VND"
          htmlFor={id + '-price'}
          error={errors.price}
          required={billable && active}
        >
          <Input
            id={id + '-price'}
            aria-invalid={errors.price ? true : undefined}
            aria-describedby={errors.price ? id + '-price-error' : id + '-price-help'}
            required={billable && active}
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            onBlur={() => {
              const parsed = parsePrice(price)
              if (typeof parsed === 'number') setPrice(vnd.format(parsed))
            }}
          />
        </FormField>
        <p id={id + '-price-help'} className="text-sm text-muted-foreground">
          Giá VND nguyên không âm, ví dụ 50.000; 0 là hợp lệ. Muốn lưu mà chưa có giá, đặt trạng
          thái Ngừng.
        </p>
        <Label htmlFor={id + '-active'} className="flex min-h-11 items-center gap-3 text-sm">
          <Checkbox
            id={id + '-active'}
            checked={active}
            onCheckedChange={(checked) => setActive(checked === true)}
            aria-invalid={errors.isActive ? true : undefined}
            aria-describedby={errors.isActive ? id + '-active-error' : undefined}
          />
          Đang hoạt động
        </Label>
        {errors.isActive && (
          <p id={id + '-active-error'} className="text-xs text-danger">
            {errors.isActive}
          </p>
        )}
      </fieldset>
      <DialogFooter className="flex-wrap gap-2">
        {initial && (
          <Button
            type="button"
            variant={initial.isActive ? 'destructive' : 'outline'}
            disabled={busy}
            onClick={() => save(undefined, true)}
          >
            {initial.isActive ? 'Ngừng dịch vụ' : 'Kích hoạt lại dịch vụ'}
          </Button>
        )}
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={busy}>
          {mutation.isPending ? 'Đang xử lý…' : 'Lưu dịch vụ'}
        </Button>
      </DialogFooter>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation === 'reload' ? 'Tải lại dữ liệu?' : 'Xác nhận trạng thái dịch vụ'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation === 'reload'
                ? 'Tải lại sẽ thay nội dung đang nhập bằng dữ liệu mới nhất. Bạn muốn tiếp tục?'
                : (confirmation === 'toggle' ? !initial?.isActive : active)
                  ? reactivate
                  : deactivate}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = confirmation
                setConfirmation(null)
                if (action === 'reload') void reload()
                else save(undefined, action === 'toggle', true)
              }}
            >
              Tiếp tục
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
