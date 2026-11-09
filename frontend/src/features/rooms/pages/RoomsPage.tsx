import { useEffect, useState } from 'react'
import { Pencil, Plus, SearchX } from 'lucide-react'
import { Badge, Button, NativeSelect, StatusBadge } from '@/components/atoms'
import { Alert, EmptyState } from '@/components/molecules'
import { DataTable, PageContainer, PageHeader, type Column } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import {
  ROOM_STATUSES,
  ROOM_STATUS_DISPLAY as statusDisplay,
  type Room,
  type RoomQuery,
  type RoomStatus,
} from '../api'
import { useRooms, useRoomTypeOptions, useActiveRoomTypeOptions } from '../hooks'
import { RoomEditor } from '../components/RoomForm'

export function RoomsPage() {
  const [editor, setEditor] = useState<{ id: string | null } | null>(null)
  const [success, setSuccess] = useState(false)
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
  const activeTypes = useActiveRoomTypeOptions()
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

  const columns: Column<Room>[] = [
    {
      key: 'roomNumber',
      header: 'Số phòng',
      rowHeader: true,
      render: (room) => (
        <span className="block min-w-16 max-w-32 break-words">{room.roomNumber}</span>
      ),
    },
    { key: 'floor', header: 'Tầng' },
    {
      key: 'roomType',
      header: 'Loại phòng',
      render: (room) => (
        <div className="flex min-w-32 max-w-64 flex-wrap items-center gap-2 break-words">
          {room.roomType ? (
            <>
              <span className="min-w-0 break-words">{room.roomType.name}</span>
              {!room.roomType.isActive && <Badge tone="neutral">Loại phòng ngừng</Badge>}
            </>
          ) : (
            <span className="text-muted-foreground">Không tìm thấy loại phòng</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái vận hành',
      render: (room) => <StatusBadge status={room.status} />,
    },
    {
      key: 'notes',
      header: 'Ghi chú',
      render: (room) => (
        <span
          className="block max-w-64 min-w-32 truncate text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
          title={room.notes || undefined}
          tabIndex={room.notes ? 0 : undefined}
          aria-label={room.notes || undefined}
        >
          {room.notes || 'Không có ghi chú'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Hoạt động',
      render: (room) => (
        <Badge tone={room.isActive ? 'success' : 'neutral'}>
          {room.isActive ? 'Đang hoạt động' : 'Ngừng'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right',
      render: (room) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={'Sửa phòng ' + room.roomNumber}
          onClick={() => {
            setSuccess(false)
            setEditor({ id: room.id })
          }}
        >
          <Pencil className="size-4" />
        </Button>
      ),
    },
  ]
  return (
    <PageContainer>
      <PageHeader
        title="Quản lý phòng"
        subtitle="Thêm phòng, gán loại phòng và kiểm soát tình trạng."
        actions={
          <Button
            type="button"
            className="rounded-full"
            disabled={!activeTypes.data?.length || activeTypes.isError || activeTypes.isPending}
            onClick={() => {
              setSuccess(false)
              setEditor({ id: null })
            }}
          >
            <Plus className="size-4" />
            Thêm phòng
          </Button>
        }
      />
      {success && <Alert tone="success">Đã lưu phòng. Danh sách đã được cập nhật.</Alert>}
      {activeTypes.isPending && <p role="status">Đang kiểm tra loại phòng khả dụng…</p>}
      {activeTypes.isError && (
        <div className="mb-4 space-y-3">
          <Alert tone="danger">
            Không tải được loại phòng khả dụng: {getErrorMessage(activeTypes.error)}
          </Alert>
          <Button
            type="button"
            variant="outline"
            disabled={activeTypes.isFetching}
            onClick={() => void activeTypes.refetch()}
          >
            Thử lại loại phòng khả dụng
          </Button>
        </div>
      )}
      {activeTypes.isSuccess && !activeTypes.data.length && (
        <Alert tone="warning">
          Chưa có loại phòng hoạt động nên chưa thể thêm phòng.{' '}
          <a
            href="/manager/room-types"
            className="underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Quản lý loại phòng
          </a>
        </Alert>
      )}
      {editor && (
        <RoomEditor
          id={editor.id}
          onClose={() => setEditor(null)}
          onSuccess={() => {
            setEditor(null)
            setSuccess(true)
          }}
        />
      )}
      {types.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tải loại phòng…
        </p>
      )}
      {types.isError && (
        <div className="mb-4 space-y-3">
          <Alert tone="danger">
            Không tải được bộ lọc loại phòng: {getErrorMessage(types.error)}
          </Alert>
          <Button
            type="button"
            variant="outline"
            disabled={types.isFetching}
            onClick={() => void types.refetch()}
          >
            Thử lại loại phòng
          </Button>
        </div>
      )}
      {rooms.isPending && (
        <p role="status" className="sr-only">
          Đang tải phòng…
        </p>
      )}
      {rooms.isError && (
        <div className="mb-4 space-y-3">
          <Alert tone="danger">{getErrorMessage(rooms.error)}</Alert>
          <Button
            type="button"
            variant="outline"
            disabled={rooms.isFetching}
            onClick={() => void rooms.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}
      <div role="search" aria-label="Lọc danh sách phòng">
        <DataTable
          rows={rooms.isError ? [] : (rooms.data?.items ?? [])}
          columns={columns}
          caption="Danh sách phòng"
          scrollLabel="Danh sách phòng, cuộn ngang để xem đủ cột"
          loading={rooms.isPending}
          searchValue={search}
          onSearchChange={setSearch}
          searchAriaLabel="Tìm theo số phòng"
          searchPlaceholder="Nhập số phòng"
          searchMaxLength={100}
          toolbarStart={
            <>
              <NativeSelect
                aria-label="Trạng thái vận hành"
                className="h-9 rounded-full md:w-44"
                value={query.status ?? ''}
                onChange={(event) =>
                  filter({ status: (event.target.value || undefined) as RoomStatus | undefined })
                }
              >
                <option value="">Tất cả trạng thái</option>
                {ROOM_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusDisplay[status].label}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="Loại phòng"
                className="h-9 rounded-full md:w-44"
                value={query.roomTypeId ?? ''}
                disabled={types.isPending || types.isError}
                onChange={(event) => filter({ roomTypeId: event.target.value || undefined })}
              >
                <option value="">Tất cả loại phòng</option>
                {(types.data ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                    {type.isActive ? '' : ' (ngừng)'}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="Hoạt động"
                className="h-9 rounded-full md:w-44"
                value={query.isActive === undefined ? '' : String(query.isActive)}
                onChange={(event) =>
                  filter({
                    isActive: event.target.value === '' ? undefined : event.target.value === 'true',
                  })
                }
              >
                <option value="">Tất cả</option>
                <option value="true">Đang hoạt động</option>
                <option value="false">Ngừng</option>
              </NativeSelect>
            </>
          }
          page={query.page}
          totalPages={pages}
          onPageChange={(page) => setQuery((previous) => ({ ...previous, page }))}
          paginationDisabled={rooms.isFetching}
          paginationLabel="Phân trang phòng"
          paginationSummary={<span aria-live="polite">{rooms.data?.total ?? 0} phòng</span>}
          empty={
            <div role="status">
              <EmptyState
                icon={SearchX}
                title={
                  rooms.isError
                    ? 'Không tải được danh sách phòng.'
                    : filtered
                      ? 'Không có kết quả khớp bộ lọc.'
                      : 'Chưa có phòng nào.'
                }
              />
            </div>
          }
        />
      </div>
    </PageContainer>
  )
}
