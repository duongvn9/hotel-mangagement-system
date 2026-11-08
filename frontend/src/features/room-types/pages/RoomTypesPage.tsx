import { useEffect, useState } from 'react'
import { Pencil, Plus, SearchX } from 'lucide-react'
import { RoomGallery } from '@/components/AssetImage'
import { Badge, Button, NativeSelect } from '@/components/atoms'
import { Alert, EmptyState } from '@/components/molecules'
import { DataTable, PageContainer, PageHeader, type Column } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { AmenityChips } from '../components/AmenityChips'
import { useRoomTypes } from '../hooks'
import type { RoomType, RoomTypeQuery } from '../api'
import { RoomTypeEditor } from '../components/RoomTypeForm'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

/** Manager catalog; availability is not date-based physical inventory. */
export function RoomTypesPage() {
  const [editor, setEditor] = useState<{ id: string | null } | null>(null)
  const [success, setSuccess] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState<RoomTypeQuery>({ page: 1, limit: 10 })
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((previous) =>
        previous.search === (search.trim() || undefined)
          ? previous
          : { ...previous, search: search.trim() || undefined, page: 1 },
      )
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])
  const { data, isPending, isError, error, refetch, isFetching } = useRoomTypes(query)
  const filtered = Boolean(query.search || query.isActive !== undefined)
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  const columns: Column<RoomType>[] = [
    {
      key: 'name',
      header: 'Tên',
      rowHeader: true,
      render: (roomType) => (
        <div className="flex items-center gap-3">
          <RoomGallery images={roomType.images} name={roomType.name} compact />
          <span className="max-w-48 min-w-24 break-words">{roomType.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      render: (roomType) => (
        <p className="max-w-64 min-w-32 break-words text-muted-foreground">
          {roomType.description || 'Chưa có mô tả'}
        </p>
      ),
    },
    { key: 'adultCapacity', header: 'Người lớn', className: 'text-right' },
    { key: 'childCapacity', header: 'Trẻ em', className: 'text-right' },
    {
      key: 'basePrice',
      header: 'Giá',
      className: 'text-right whitespace-nowrap',
      render: (roomType) => money.format(roomType.basePrice),
    },
    {
      key: 'amenities',
      header: 'Tiện nghi',
      render: (roomType) => (
        <div className="min-w-32 max-w-64">
          <AmenityChips amenities={roomType.amenities} />
        </div>
      ),
    },
    {
      key: 'availability',
      header: 'Trạng thái',
      render: (roomType) => (
        <Badge tone={roomType.availableForBooking ? 'success' : 'neutral'}>
          {roomType.availableForBooking ? 'Có thể đặt' : 'Ngừng đặt'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right',
      render: (roomType) => (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={`Sửa ${roomType.name}`}
          onClick={() => {
            setSuccess(false)
            setEditor({ id: roomType.id })
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
        title="Quản lý loại phòng"
        subtitle="Hạng phòng, giá mỗi đêm và sức chứa hiển thị trên trang web."
        actions={
          <Button
            type="button"
            className="rounded-full"
            onClick={() => {
              setSuccess(false)
              setEditor({ id: null })
            }}
          >
            <Plus className="size-4" />
            Thêm loại phòng
          </Button>
        }
      />
      {success && <Alert tone="success">Đã lưu loại phòng. Danh sách đã được cập nhật.</Alert>}
      {editor && (
        <RoomTypeEditor
          id={editor.id}
          onClose={() => setEditor(null)}
          onSuccess={() => {
            setEditor(null)
            setSuccess(true)
          }}
        />
      )}
      {isPending && (
        <p role="status" className="sr-only">
          Đang tải loại phòng…
        </p>
      )}
      {isError && (
        <div className="mb-4 space-y-3">
          <Alert tone="danger">{getErrorMessage(error)}</Alert>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Thử lại
          </Button>
        </div>
      )}
      <div role="search" aria-label="Lọc loại phòng">
        <DataTable
          rows={isError ? [] : (data?.items ?? [])}
          columns={columns}
          caption="Danh sách loại phòng"
          scrollLabel="Danh sách loại phòng, cuộn ngang để xem đủ cột"
          loading={isPending}
          searchValue={search}
          onSearchChange={setSearch}
          searchAriaLabel="Tìm theo tên"
          searchPlaceholder="Nhập tên loại phòng"
          searchMaxLength={100}
          toolbarStart={
            <NativeSelect
              aria-label="Trạng thái"
              className="h-9 rounded-full md:w-44"
              value={query.isActive === undefined ? '' : String(query.isActive)}
              onChange={(event) => {
                const value = event.target.value
                setQuery((previous) => ({
                  ...previous,
                  page: 1,
                  isActive: value === '' ? undefined : value === 'true',
                }))
              }}
            >
              <option value="">Tất cả</option>
              <option value="true">Có thể đặt</option>
              <option value="false">Ngừng</option>
            </NativeSelect>
          }
          page={query.page}
          totalPages={pages}
          onPageChange={(page) => setQuery((previous) => ({ ...previous, page }))}
          paginationDisabled={isFetching}
          paginationSummary={<span aria-live="polite">{data?.total ?? 0} loại phòng</span>}
          empty={
            <div role="status">
              <EmptyState
                icon={SearchX}
                title={
                  isError
                    ? 'Không tải được danh sách loại phòng.'
                    : filtered
                      ? 'Không có loại phòng khớp bộ lọc.'
                      : 'Chưa có dữ liệu loại phòng.'
                }
              />
            </div>
          }
        />
      </div>
    </PageContainer>
  )
}
