import { useEffect, useState } from 'react'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { ROOM_STATUSES, type RoomQuery, type RoomStatus } from '../api'
import { useRooms, useRoomTypeOptions } from '../hooks'

const statusDisplay = {
  AVAILABLE: { label: 'Trống', tone: 'success' },
  OCCUPIED: { label: 'Có khách', tone: 'info' },
  CLEANING: { label: 'Đang dọn', tone: 'warning' },
  MAINTENANCE: { label: 'Bảo trì', tone: 'danger' },
} as const

export function RoomsPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState<RoomQuery>({ page: 1, limit: 10 })
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setQuery((previous) =>
          previous.search === (search.trim() || undefined)
            ? previous
            : { ...previous, search: search.trim() || undefined, page: 1 },
        ),
      300,
    )
    return () => window.clearTimeout(timer)
  }, [search])
  const rooms = useRooms(query)
  const types = useRoomTypeOptions()
  const filtered = Boolean(
    query.search ||
    query.roomTypeId ||
    query.status ||
    query.isActive !== undefined ||
    query.floor !== undefined,
  )
  const pages = rooms.data ? Math.max(1, Math.ceil(rooms.data.total / rooms.data.limit)) : 1
  function filter(change: Partial<RoomQuery>) {
    setQuery((previous) => ({ ...previous, ...change, page: 1 }))
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Quản trị</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Quản lý phòng</h1>
        <p className="mt-2 text-sm text-stone-700">
          Danh sách phòng và trạng thái vận hành đã ghi nhận.
        </p>
      </div>
      <div
        role="search"
        aria-label="Lọc danh sách phòng"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <TextField
          label="Tìm theo số phòng"
          type="search"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nhập số phòng"
        />
        <div className="min-w-0 space-y-2">
          <SelectField
            label="Loại phòng"
            value={query.roomTypeId ?? ''}
            disabled={types.isPending || types.isError}
            options={[
              { value: '', label: 'Tất cả loại phòng' },
              ...(types.data ?? []).map((type) => ({
                value: type.id,
                label: `${type.name}${type.isActive ? '' : ' (ngừng)'}`,
              })),
            ]}
            onChange={(event) => filter({ roomTypeId: event.target.value || undefined })}
          />
          {types.isPending && (
            <p role="status" className="text-sm text-stone-700">
              Đang tải loại phòng…
            </p>
          )}
          {types.isError && (
            <>
              <Alert tone="danger">
                Không tải được bộ lọc loại phòng: {getErrorMessage(types.error)}
              </Alert>
              <Button
                variant="secondary"
                disabled={types.isFetching}
                onClick={() => void types.refetch()}
              >
                Thử lại loại phòng
              </Button>
            </>
          )}
        </div>
        <SelectField
          label="Trạng thái vận hành"
          value={query.status ?? ''}
          options={[
            { value: '', label: 'Tất cả trạng thái' },
            ...ROOM_STATUSES.map((status) => ({
              value: status,
              label: statusDisplay[status].label,
            })),
          ]}
          onChange={(event) =>
            filter({ status: (event.target.value || undefined) as RoomStatus | undefined })
          }
        />
        <SelectField
          label="Hoạt động"
          value={query.isActive === undefined ? '' : String(query.isActive)}
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'true', label: 'Đang hoạt động' },
            { value: 'false', label: 'Ngừng' },
          ]}
          onChange={(event) =>
            filter({
              isActive: event.target.value === '' ? undefined : event.target.value === 'true',
            })
          }
        />
      </div>
      {rooms.isPending && <p role="status">Đang tải phòng…</p>}
      {rooms.isError && (
        <div className="space-y-3">
          <Alert tone="danger">{getErrorMessage(rooms.error)}</Alert>
          <Button
            variant="secondary"
            disabled={rooms.isFetching}
            onClick={() => void rooms.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}
      {!rooms.isError && rooms.data && (
        <>
          {rooms.data.items.length === 0 ? (
            <p
              role="status"
              className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700"
            >
              {filtered ? 'Không có kết quả khớp bộ lọc.' : 'Chưa có phòng nào.'}
            </p>
          ) : (
            <div
              role="region"
              aria-label="Danh sách phòng, cuộn ngang để xem đủ cột"
              tabIndex={0}
              className="max-w-full overflow-x-auto rounded-lg border border-stone-300 bg-white"
            >
              <table className="w-full min-w-[850px] text-left text-sm">
                <caption className="sr-only">Danh sách phòng</caption>
                <thead className="bg-stone-200 text-xs text-stone-700 uppercase">
                  <tr>
                    {[
                      'Số phòng',
                      'Tầng',
                      'Loại phòng',
                      'Trạng thái vận hành',
                      'Ghi chú',
                      'Hoạt động',
                    ].map((name, index) => (
                      <th
                        scope="col"
                        key={name}
                        className={`px-4 py-4 ${index < 2 ? 'text-right' : ''}`}
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rooms.data.items.map((room) => (
                    <tr key={room.id} className="border-t border-stone-300 hover:bg-cream-50">
                      <th scope="row" className="px-4 py-4 text-right font-semibold">
                        {room.roomNumber}
                      </th>
                      <td className="px-4 py-4 text-right">{room.floor}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {room.roomType ? (
                            <>
                              {room.roomType.name}
                              {!room.roomType.isActive && (
                                <Badge tone="neutral">Loại phòng ngừng</Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-stone-700">Không tìm thấy loại phòng</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={statusDisplay[room.status]?.tone ?? 'neutral'}>
                          {statusDisplay[room.status]?.label ?? 'Chưa rõ trạng thái'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className="block max-w-64 truncate text-stone-700"
                          title={room.notes || undefined}
                          tabIndex={room.notes ? 0 : undefined}
                          aria-label={room.notes || undefined}
                        >
                          {room.notes || 'Không có ghi chú'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={room.isActive ? 'success' : 'neutral'}>
                          {room.isActive ? 'Đang hoạt động' : 'Ngừng'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label="Phân trang phòng"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-stone-700" aria-live="polite">
              {rooms.data.total} phòng · Trang {query.page}/{pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={query.page <= 1 || rooms.isFetching}
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page - 1 }))}
              >
                Trang trước
              </Button>
              <Button
                variant="secondary"
                disabled={query.page >= pages || rooms.isFetching}
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page + 1 }))}
              >
                Trang sau
              </Button>
            </div>
          </nav>
        </>
      )}
    </section>
  )
}
