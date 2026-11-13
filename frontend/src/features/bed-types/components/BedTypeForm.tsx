import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button, Input, Label, Textarea } from '@/components/atoms'
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
import { createBedType, getBedType, updateBedType, type BedType, type BedTypeInput } from '../api'

export function BedTypeEditor({
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
    queryKey: ['bed-type', id],
    queryFn: () => getBedType(id!),
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
          <DialogTitle>{id ? 'Sửa loại giường' : 'Thêm loại giường'}</DialogTitle>
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
          <BedTypeForm
            initial={id ? query.data : undefined}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

const deactivate =
  'Loại giường được giữ lại và các loại phòng đang dùng vẫn hợp lệ, nhưng không thể gắn mới. Bạn muốn ngừng loại giường này?'
const reactivate = 'Bạn muốn kích hoạt lại loại giường này để có thể gắn vào loại phòng?'

export function BedTypeForm({
  initial,
  onClose,
  onSuccess,
}: {
  initial?: BedType
  onClose: () => void
  onSuccess: () => void
}) {
  const form = useRef<HTMLFormElement>(null)
  const locked = useRef(false)
  const id = useId()
  const client = useQueryClient()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [active, setActive] = useState(initial?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState('')
  const [confirmationMode, setConfirmationMode] = useState<'toggle' | 'save' | null>(null)
  const focusError = () =>
    window.setTimeout(
      () => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      0,
    )
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>('input')?.focus()
  }, [])
  const mutation = useMutation({
    mutationFn: async (input: Partial<BedTypeInput>) =>
      initial ? updateBedType(initial.id, input) : createBedType(input as BedTypeInput),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['bed-types'] }),
        client.invalidateQueries({ queryKey: ['bed-type', initial?.id] }),
        client.invalidateQueries({ queryKey: ['bed-type-options'] }),
      ])
      onSuccess()
    },
    onError: (error) => {
      const message = getErrorMessage(error)
      if (axios.isAxiosError(error) && error.response?.status === 409 && /tên|name/i.test(message))
        setErrors({ name: message })
      else {
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
  function save(event?: FormEvent, toggle = false, confirmed = false) {
    event?.preventDefault()
    if (locked.current) return
    setGeneral('')
    setErrors({})
    if (toggle && initial) {
      if (!confirmed) {
        setConfirmationMode('toggle')
        return
      }
      locked.current = true
      mutation.mutate({ isActive: !initial.isActive })
      return
    }
    const next: Record<string, string> = {}
    if (!name.trim() || name.trim().length > 100)
      next.name = 'Nhập tên loại giường (tối đa 100 ký tự).'
    setErrors(next)
    if (Object.keys(next).length) {
      focusError()
      return
    }
    if (initial && active !== initial.isActive && !confirmed) {
      setConfirmationMode('save')
      return
    }
    const input: BedTypeInput = {
      name: name.trim(),
      description: description.trim(),
      isActive: active,
    }
    const changes: Partial<BedTypeInput> = initial
      ? {
          ...(input.name === initial.name ? {} : { name: input.name }),
          ...(input.description === initial.description ? {} : { description: input.description }),
          ...(input.isActive === initial.isActive ? {} : { isActive: input.isActive }),
        }
      : input
    if (!Object.keys(changes).length) {
      onClose()
      return
    }
    locked.current = true
    mutation.mutate(changes)
  }
  const confirmingActive = confirmationMode === 'toggle' ? !initial?.isActive : active
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
        <FormField label="Tên loại giường" htmlFor={id + '-name'} required error={errors.name}>
          <Input
            id={id + '-name'}
            required
            autoFocus
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? id + '-name-error' : undefined}
          />
        </FormField>
        <FormField label="Mô tả" htmlFor={id + '-description'} error={errors.description}>
          <Textarea
            id={id + '-description'}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? id + '-description-error' : undefined}
          />
        </FormField>
        <Label className="flex min-h-11 items-center gap-3 text-sm">
          <Input
            type="checkbox"
            className="size-4 shrink-0"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Đang hoạt động
        </Label>
      </fieldset>
      <DialogFooter className="flex-wrap gap-2 pt-2 sm:space-x-0">
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
          Hủy
        </Button>
        {initial && (
          <Button
            type="button"
            variant={initial.isActive ? 'destructive' : 'outline'}
            disabled={mutation.isPending}
            onClick={() => save(undefined, true)}
          >
            {initial.isActive ? 'Ngừng loại giường' : 'Kích hoạt lại loại giường'}
          </Button>
        )}
        <Button
          type="submit"
          disabled={mutation.isPending}
          aria-busy={mutation.isPending || undefined}
        >
          {mutation.isPending ? 'Đang xử lý…' : 'Lưu loại giường'}
        </Button>
      </DialogFooter>
      <AlertDialog
        open={confirmationMode !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmationMode(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmingActive ? 'Kích hoạt lại loại giường?' : 'Ngừng loại giường?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmingActive ? reactivate : deactivate}
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
              onClick={() => save(undefined, confirmationMode === 'toggle', true)}
            >
              {confirmingActive ? 'Kích hoạt lại loại giường' : 'Ngừng loại giường'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
