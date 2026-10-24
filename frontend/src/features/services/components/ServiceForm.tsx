import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { createService, getService, updateService, type Service, type ServiceInput } from '../api'

export function ServiceEditor({
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
    queryKey: ['service', id],
    queryFn: () => getService(id!),
    enabled: id !== null,
    refetchOnWindowFocus: false,
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
      aria-labelledby="service-form-title"
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-lg border border-stone-300 bg-white p-6 font-body text-pearl-900 backdrop:bg-pearl-900/50"
      onCancel={(event) => {
        event.preventDefault()
        if (!dialog.current?.querySelector('[aria-busy="true"]')) onClose()
      }}
    >
      <h2 id="service-form-title" className="mb-6 font-display text-3xl">
        {id ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}
      </h2>
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
    </dialog>
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [conflict, setConflict] = useState(false)
  const [reloading, setReloading] = useState(false)
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
    mutationFn: (input: Partial<ServiceInput>) =>
      initial ? updateService(initial.id, input) : createService(input as ServiceInput),
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
    if (
      !initial ||
      locked.current ||
      !window.confirm(
        'Tải lại sẽ thay nội dung đang nhập bằng dữ liệu mới nhất. Bạn muốn tiếp tục?',
      )
    )
      return
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
  function save(event?: FormEvent, toggle = false) {
    event?.preventDefault()
    if (locked.current) return
    setGeneral('')
    setErrors({})
    setConflict(false)
    if (toggle && initial) {
      if (!window.confirm(initial.isActive ? deactivate : reactivate)) return
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
    if (initial && active !== initial.isActive && !window.confirm(active ? reactivate : deactivate))
      return
    const input: ServiceInput = {
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
    if (!Object.keys(changes).length) {
      onClose()
      return
    }
    locked.current = true
    mutation.mutate(changes)
  }
  return (
    <form ref={form} noValidate onSubmit={save} aria-busy={busy} className="space-y-4">
      {general && <Alert tone="danger">{general}</Alert>}
      {conflict && initial && (
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void reload()}>
          Tải lại dữ liệu
        </Button>
      )}
      {reloading && <p role="status">Đang tải lại dữ liệu…</p>}
      <fieldset disabled={busy} className="space-y-4">
        <TextField
          label="Tên dịch vụ"
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
        <TextField
          label="Đơn vị (tùy chọn)"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          error={errors.unit}
        />
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={billable}
            onChange={(event) => setBillable(event.target.checked)}
            aria-invalid={errors.billable ? true : undefined}
            aria-describedby={errors.billable ? id + '-billable-error' : undefined}
          />
          Tính phí
        </label>
        {errors.billable && (
          <p id={id + '-billable-error'} className="text-xs text-danger">
            {errors.billable}
          </p>
        )}
        <TextField
          label="Giá VND"
          required={billable && active}
          inputMode="numeric"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          onBlur={() => {
            const parsed = parsePrice(price)
            if (typeof parsed === 'number') setPrice(vnd.format(parsed))
          }}
          error={errors.price}
          {...(errors.price ? {} : { 'aria-describedby': id + '-price-help' })}
        />
        <p id={id + '-price-help'} className="text-sm text-stone-700">
          Giá VND nguyên không âm, ví dụ 50.000; 0 là hợp lệ. Muốn lưu mà chưa có giá, đặt trạng
          thái Ngừng.
        </p>
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
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={mutation.isPending} disabled={reloading}>
          Lưu dịch vụ
        </Button>
        {initial && (
          <Button
            type="button"
            variant={initial.isActive ? 'danger' : 'secondary'}
            disabled={busy}
            onClick={() => save(undefined, true)}
          >
            {initial.isActive ? 'Ngừng dịch vụ' : 'Kích hoạt lại dịch vụ'}
          </Button>
        )}
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
          Hủy
        </Button>
      </div>
    </form>
  )
}
