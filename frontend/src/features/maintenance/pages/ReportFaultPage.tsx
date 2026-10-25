import { isAxiosError } from 'axios'
import { Link } from 'react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'
import { reportFault, searchTargets, type FaultInput, type MaintenanceTargets } from '../api'

export function ReportFaultPage() {
  const { me } = useAuth()
  const [mode, setMode] = useState('ROOM')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [room, setRoom] = useState<MaintenanceTargets['rooms'][number]>()
  const [equipment, setEquipment] = useState<MaintenanceTargets['equipment'][number]>()
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [action, setAction] = useState(true)
  const [unsafe, setUnsafe] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [locked, setLocked] = useState(false)
  const key = useRef<string | undefined>(undefined)
  const submitting = useRef(false)
  const cache = useQueryClient()
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])
  const targets = useQuery({
    queryKey: ['maintenance-targets', me?.id, debounced],
    queryFn: () => searchTargets(debounced),
    enabled: mode !== 'FACILITY',
  })
  const mutation = useMutation({
    mutationFn: ({ input, requestKey }: { input: FaultInput; requestKey: string }) =>
      reportFault(input, requestKey),
    retry: false,
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['maintenance-targets'] })
      void cache.invalidateQueries({ queryKey: ['rooms'] })
      void cache.invalidateQueries({ queryKey: ['tasks'] })
      void cache.invalidateQueries({ queryKey: ['maintenance-history'] })
    },
  })
  function clearErrors(...fields: string[]) {
    setErrors((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([field]) => !fields.includes(field))),
    )
    mutation.reset()
  }
  const rooms = [
    ...new Map(
      [...(targets.data?.rooms ?? []), ...(room ? [room] : [])].map((r) => [r.id, r]),
    ).values(),
  ]
  const devices = [
    ...new Map(
      [...(targets.data?.equipment ?? []), ...(equipment ? [equipment] : [])].map((e) => [e.id, e]),
    ).values(),
  ]
  const affectedRoom =
    mode === 'ROOM' ? room?.id : mode === 'EQUIPMENT' ? equipment?.roomId : undefined
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || mutation.isSuccess) return
    const next: Record<string, string> = {}
    if ((mode === 'ROOM' && !room) || (mode === 'EQUIPMENT' && !equipment))
      next.targetId = 'Chọn phòng hoặc thiết bị bị ảnh hưởng.'
    if (mode === 'FACILITY' && (!location.trim() || location.trim().length > 200))
      next.facilityLocation = 'Nhập vị trí cơ sở, tối đa 200 ký tự.'
    if (!description.trim() || description.trim().length > 2000)
      next.description = 'Nhập mô tả lỗi, tối đa 2.000 ký tự.'
    if (unsafe && !affectedRoom)
      next.preventsSafeUse = 'Cần chọn phòng hoặc thiết bị thuộc phòng để đánh dấu không khả dụng.'
    setErrors(next)
    if (Object.keys(next).length) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus()
      return
    }
    const input: FaultInput = {
      description: description.trim(),
      requiresAction: action,
      preventsSafeUse: unsafe,
      ...(mode === 'ROOM'
        ? { roomId: room!.id }
        : mode === 'EQUIPMENT'
          ? { equipmentId: equipment!.id }
          : { facilityLocation: location.trim() }),
    }
    key.current ??= crypto.randomUUID()
    submitting.current = true
    setLocked(true)
    try {
      await mutation.mutateAsync({ input, requestKey: key.current })
    } catch (error) {
      // Only validation/auth failures before a write permit editing. Unknown/partial outcomes retain the exact request.
      if (isAxiosError(error) && [400, 401, 403].includes(error.response?.status ?? 0)) {
        setLocked(false)
        const message = getErrorMessage(error)
        const serverErrors: Record<string, string> = {}
        if (/description|mô tả/i.test(message)) serverErrors.description = message
        if (/equipmentId|thiết bị|roomId|phòng/i.test(message)) serverErrors.targetId = message
        if (/facilityLocation|vị trí/i.test(message)) serverErrors.facilityLocation = message
        setErrors(serverErrors)
      }
    } finally {
      submitting.current = false
    }
  }
  function reset() {
    mutation.reset()
    key.current = undefined
    setLocked(false)
    setErrors({})
    setMode('ROOM')
    setRoom(undefined)
    setEquipment(undefined)
    setLocation('')
    setDescription('')
    setAction(true)
    setUnsafe(false)
    setSearch('')
  }
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <h1 className="font-display text-4xl font-semibold">Báo hỏng thiết bị</h1>
      <p className="mt-3 text-sm text-stone-700">
        Ghi nhận lỗi thiết bị, hư hại cơ sở vật chất hoặc vấn đề cần bảo trì.
      </p>
      {mutation.isSuccess ? (
        <div className="mt-6 space-y-5 rounded border border-stone-300 bg-white p-4 sm:p-6">
          <Alert tone="success">Đã ghi nhận báo cáo bảo trì.</Alert>
          <dl className="space-y-2 break-all text-sm">
            <dt className="font-semibold">Mã báo cáo</dt>
            <dd>{mutation.data.reportId}</dd>
            {mutation.data.taskId && (
              <>
                <dt className="font-semibold">Mã công việc bảo trì</dt>
                <dd>{mutation.data.taskId}</dd>
              </>
            )}
          </dl>
          <p>
            {mutation.data.taskId
              ? 'Đã tạo công việc bảo trì và giao cho bạn.'
              : 'Không yêu cầu tạo công việc bảo trì.'}
          </p>
          <p>
            {mutation.data.roomMarkedUnavailable
              ? 'Phòng đã được đánh dấu bảo trì, không khả dụng.'
              : 'Báo cáo này chưa đánh dấu phòng không khả dụng.'}
          </p>
          {mutation.data.warnings.map((warning) => (
            <Alert key={warning} tone="warning">
              {warning}
            </Alert>
          ))}
          <Link
            className="inline-flex min-h-11 items-center text-primary underline"
            to="/operations/maintenance/history"
          >
            Xem lịch sử bảo trì
          </Link>
          <Button onClick={reset}>Báo cáo vấn đề khác</Button>
        </div>
      ) : (
        <form
          className="mt-6 space-y-5"
          noValidate
          onSubmit={submit}
          aria-busy={mutation.isPending}
        >
          <fieldset disabled={locked || mutation.isPending} className="min-w-0 space-y-5">
            <SelectField
              name="mode"
              label="Đối tượng bị ảnh hưởng"
              value={mode}
              options={[
                { value: 'ROOM', label: 'Phòng' },
                { value: 'EQUIPMENT', label: 'Thiết bị' },
                { value: 'FACILITY', label: 'Khu vực / cơ sở khác' },
              ]}
              onChange={(e) => {
                setMode(e.target.value)
                setErrors({})
              }}
            />
            {mode === 'FACILITY' ? (
              <TextField
                name="facilityLocation"
                label="Vị trí cơ sở"
                required
                maxLength={200}
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value)
                  clearErrors('facilityLocation')
                }}
                error={errors.facilityLocation}
              />
            ) : (
              <>
                <TextField
                  name="search"
                  label="Tìm phòng hoặc thiết bị"
                  maxLength={100}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {targets.isPending && <p role="status">Đang tải đối tượng…</p>}
                {targets.isError && (
                  <Alert tone="danger">
                    {getErrorMessage(targets.error, 'Không tải được đối tượng.')}{' '}
                    <Button variant="ghost" onClick={() => void targets.refetch()}>
                      Thử lại tìm kiếm
                    </Button>
                  </Alert>
                )}
                {!targets.isPending &&
                  !targets.isError &&
                  !(mode === 'ROOM'
                    ? targets.data?.rooms.length
                    : targets.data?.equipment.length) && (
                    <p role="status">Không tìm thấy phòng/thiết bị phù hợp.</p>
                  )}
                <SelectField
                  name="targetId"
                  label={mode === 'ROOM' ? 'Phòng bị ảnh hưởng' : 'Thiết bị bị ảnh hưởng'}
                  required
                  value={mode === 'ROOM' ? (room?.id ?? '') : (equipment?.id ?? '')}
                  aria-invalid={!!errors.targetId}
                  aria-describedby="target-error"
                  options={[
                    { value: '', label: 'Chọn đối tượng' },
                    ...(mode === 'ROOM'
                      ? rooms.map((r) => ({
                          value: r.id,
                          label: `Phòng ${r.roomNumber} — tầng ${r.floor}`,
                        }))
                      : devices.map((e) => ({
                          value: e.id,
                          label: `${e.assetCode} — ${e.name} — ${e.location}`,
                        }))),
                  ]}
                  onChange={(e) => {
                    if (mode === 'ROOM') setRoom(rooms.find((r) => r.id === e.target.value))
                    else setEquipment(devices.find((item) => item.id === e.target.value))
                    clearErrors('targetId', 'preventsSafeUse')
                  }}
                />
                <p id="target-error" className="text-sm text-danger">
                  {errors.targetId}
                </p>
                {mode === 'EQUIPMENT' && equipment && (
                  <p className="text-sm text-stone-700">
                    {equipment.roomNumber
                      ? `Phòng liên quan: ${equipment.roomNumber}`
                      : 'Thiết bị cơ sở chung, không gắn phòng.'}
                  </p>
                )}
              </>
            )}
            <div>
              <label
                htmlFor="fault-description"
                className="mb-2 block text-xs font-semibold tracking-wider text-stone-700 uppercase"
              >
                Mô tả lỗi / hư hại <span className="text-danger">*</span>
              </label>
              <textarea
                id="fault-description"
                name="description"
                required
                maxLength={2000}
                rows={5}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  clearErrors('description')
                }}
                aria-invalid={!!errors.description}
                aria-describedby="description-count description-error"
                className="w-full rounded border border-stone-300 bg-white p-3 text-sm focus:border-primary disabled:bg-stone-200"
              />
              <p id="description-count" className="text-xs text-stone-700">
                {description.length}/2000 ký tự
              </p>
              <p id="description-error" className="text-sm text-danger">
                {errors.description}
              </p>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={action}
                disabled={unsafe}
                onChange={(e) => setAction(e.target.checked)}
              />
              Cần xử lý/bảo trì
            </label>
            <div>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  name="preventsSafeUse"
                  type="checkbox"
                  className="h-5 w-5"
                  checked={unsafe}
                  onChange={(e) => {
                    setUnsafe(e.target.checked)
                    clearErrors('preventsSafeUse')
                    if (e.target.checked) setAction(true)
                  }}
                  aria-invalid={!!errors.preventsSafeUse}
                  aria-describedby="safe-help safe-error"
                />
                Ngăn việc sử dụng phòng an toàn
              </label>
              <p id="safe-help" className="text-sm text-stone-700">
                Phòng sẽ được coi là không khả dụng cho tới khi xử lý xong. Phòng đang có khách cần
                lễ tân xử lý.
              </p>
              <p id="safe-error" className="text-sm text-danger">
                {errors.preventsSafeUse}
              </p>
            </div>
          </fieldset>
          {mutation.isError && (
            <Alert tone="danger">
              {getErrorMessage(
                mutation.error,
                'Chưa nhận được xác nhận. Giữ nguyên nội dung và gửi lại để tiếp tục an toàn.',
              )}
            </Alert>
          )}
          {locked && mutation.isError && (
            <p className="text-sm text-stone-700">
              Nội dung được giữ nguyên để gửi lại cùng báo cáo, tránh tạo trùng công việc.
            </p>
          )}
          <Button type="submit" loading={mutation.isPending} className="w-full sm:w-auto">
            {locked && mutation.isError ? 'Gửi lại báo cáo' : 'Gửi báo cáo'}
          </Button>
        </form>
      )}
    </section>
  )
}
