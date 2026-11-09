import { AssetImage } from '@/components/AssetImage'
import { isAxiosError } from 'axios'
import { Link } from 'react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { Button, Input, Label, NativeSelect, Textarea } from '@/components/atoms'
import { Alert, EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
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
    <PageContainer>
      <PageHeader
        title="Báo hỏng thiết bị"
        subtitle="Ghi nhận lỗi thiết bị, hư hại cơ sở vật chất hoặc vấn đề cần bảo trì."
      />
      {mutation.isSuccess ? (
        <div className="py-10">
          <div role="status">
            <EmptyState
              icon={CheckCircle2}
              title="Đã ghi nhận báo cáo bảo trì."
              body={
                mutation.data.taskId
                  ? 'Đã tạo công việc bảo trì và giao cho bạn.'
                  : 'Không yêu cầu tạo công việc bảo trì.'
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/operations/maintenance/history">Xem lịch sử bảo trì</Link>
                  </Button>
                  <Button type="button" className="rounded-full" onClick={reset}>
                    Báo cáo vấn đề khác
                  </Button>
                </div>
              }
            />
          </div>
          <div className="mt-4 space-y-3 text-center text-sm break-words text-muted-foreground">
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
          </div>
        </div>
      ) : (
        <Panel>
          <form
            className="grid min-w-0 max-w-2xl grid-cols-1 gap-4"
            noValidate
            onSubmit={submit}
            aria-busy={mutation.isPending}
          >
            <fieldset
              disabled={locked || mutation.isPending}
              className="grid min-w-0 grid-cols-1 gap-4"
            >
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <FormField label="Đối tượng bị ảnh hưởng" htmlFor="fault-mode" className="min-w-0">
                  <NativeSelect
                    id="fault-mode"
                    name="mode"
                    value={mode}
                    onChange={(e) => {
                      setMode(e.target.value)
                      setErrors({})
                    }}
                  >
                    <option value="ROOM">Phòng</option>
                    <option value="EQUIPMENT">Thiết bị</option>
                    <option value="FACILITY">Khu vực / cơ sở khác</option>
                  </NativeSelect>
                </FormField>
                {mode === 'FACILITY' ? (
                  <FormField
                    label="Vị trí cơ sở"
                    htmlFor="fault-location"
                    required
                    error={errors.facilityLocation}
                    className="min-w-0"
                  >
                    <Input
                      id="fault-location"
                      name="facilityLocation"
                      required
                      maxLength={200}
                      value={location}
                      aria-invalid={!!errors.facilityLocation}
                      aria-describedby={
                        errors.facilityLocation ? 'fault-location-error' : undefined
                      }
                      onChange={(e) => {
                        setLocation(e.target.value)
                        clearErrors('facilityLocation')
                      }}
                    />
                  </FormField>
                ) : (
                  <FormField
                    label="Tìm phòng hoặc thiết bị"
                    htmlFor="fault-search"
                    className="min-w-0"
                  >
                    <Input
                      id="fault-search"
                      name="search"
                      maxLength={100}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </FormField>
                )}
              </div>
              {mode !== 'FACILITY' && (
                <>
                  {targets.isPending && (
                    <p role="status" className="text-sm text-muted-foreground">
                      Đang tải đối tượng…
                    </p>
                  )}
                  {targets.isError && (
                    <Alert tone="danger">
                      {getErrorMessage(targets.error, 'Không tải được đối tượng.')}{' '}
                      <Button type="button" variant="ghost" onClick={() => void targets.refetch()}>
                        Thử lại tìm kiếm
                      </Button>
                    </Alert>
                  )}
                  {!targets.isPending &&
                    !targets.isError &&
                    !(mode === 'ROOM'
                      ? targets.data?.rooms.length
                      : targets.data?.equipment.length) && (
                      <p role="status" className="text-sm text-muted-foreground">
                        Không tìm thấy phòng/thiết bị phù hợp.
                      </p>
                    )}
                  <FormField
                    label={mode === 'ROOM' ? 'Phòng bị ảnh hưởng' : 'Thiết bị bị ảnh hưởng'}
                    htmlFor="fault-target"
                    required
                    className="min-w-0"
                  >
                    <NativeSelect
                      id="fault-target"
                      name="targetId"
                      required
                      value={mode === 'ROOM' ? (room?.id ?? '') : (equipment?.id ?? '')}
                      aria-invalid={!!errors.targetId}
                      aria-describedby="target-error"
                      onChange={(e) => {
                        if (mode === 'ROOM') setRoom(rooms.find((r) => r.id === e.target.value))
                        else setEquipment(devices.find((item) => item.id === e.target.value))
                        clearErrors('targetId', 'preventsSafeUse')
                      }}
                    >
                      <option value="">Chọn đối tượng</option>
                      {mode === 'ROOM'
                        ? rooms.map((r) => (
                            <option key={r.id} value={r.id}>
                              {'Phòng ' + r.roomNumber + ' — tầng ' + r.floor}
                            </option>
                          ))
                        : devices.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.assetCode + ' — ' + e.name + ' — ' + e.location}
                            </option>
                          ))}
                    </NativeSelect>
                    <p id="target-error" className="text-sm text-danger">
                      {errors.targetId}
                    </p>
                  </FormField>
                  {mode === 'EQUIPMENT' && equipment && (
                    <AssetImage path={equipment.imageUrl} name={equipment.name} />
                  )}
                  {mode === 'EQUIPMENT' && equipment && (
                    <p className="text-sm break-words text-muted-foreground">
                      {equipment.roomNumber
                        ? 'Phòng liên quan: ' + equipment.roomNumber
                        : 'Thiết bị cơ sở chung, không gắn phòng.'}
                    </p>
                  )}
                </>
              )}
              <FormField
                label="Mô tả lỗi / hư hại"
                htmlFor="fault-description"
                required
                className="min-w-0"
              >
                <Textarea
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
                />
                <p id="description-count" className="text-xs text-muted-foreground">
                  {description.length}/2000 ký tự
                </p>
                <p id="description-error" className="text-sm text-danger">
                  {errors.description}
                </p>
              </FormField>
              <Label htmlFor="fault-action" className="flex min-h-11 items-center gap-3 text-sm">
                <Input
                  id="fault-action"
                  type="checkbox"
                  className="size-4 shrink-0 p-0 accent-primary shadow-none"
                  checked={action}
                  disabled={unsafe}
                  onChange={(e) => setAction(e.target.checked)}
                />
                Cần xử lý/bảo trì
              </Label>
              <div>
                <Label htmlFor="fault-unsafe" className="flex min-h-11 items-center gap-3 text-sm">
                  <Input
                    id="fault-unsafe"
                    name="preventsSafeUse"
                    type="checkbox"
                    className="size-4 shrink-0 p-0 accent-primary shadow-none"
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
                </Label>
                <p id="safe-help" className="text-sm text-muted-foreground">
                  Phòng sẽ được coi là không khả dụng cho tới khi xử lý xong. Phòng đang có khách
                  cần lễ tân xử lý.
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
              <p className="text-sm text-muted-foreground">
                Nội dung được giữ nguyên để gửi lại cùng báo cáo, tránh tạo trùng công việc.
              </p>
            )}
            <Button type="submit" disabled={mutation.isPending} className="w-fit rounded-full">
              {mutation.isPending
                ? 'Đang xử lý…'
                : locked && mutation.isError
                  ? 'Gửi lại báo cáo'
                  : 'Gửi báo cáo'}
            </Button>
          </form>
        </Panel>
      )}
    </PageContainer>
  )
}
