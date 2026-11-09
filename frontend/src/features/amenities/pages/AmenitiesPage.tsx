import { RoomGallery } from '@/components/AssetImage'
import { useEffect, useState } from 'react'
import { Pencil, Plus, SearchX } from 'lucide-react'
import { Badge, Button, NativeSelect } from '@/components/atoms'
import { Alert, EmptyState } from '@/components/molecules'
import { DataTable, PageContainer, PageHeader, type Column } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import type { Amenity, AmenityQuery } from '../api'
import { useAmenities } from '../hooks'
import { RoomTypeChips } from '../components/RoomTypeChips'
import { AmenityEditor } from '../components/AmenityForm'
export function AmenitiesPage() {
  const [editor, setEditor] = useState<{ id: string | null } | null>(null)
  const [success, setSuccess] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState<AmenityQuery>({ page: 1, limit: 10 })
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
  const amenities = useAmenities(query)
  const filtered = Boolean(query.search || query.isActive !== undefined)
  const pages = amenities.data
    ? Math.max(1, Math.ceil(amenities.data.total / amenities.data.limit))
    : 1
  const columns: Column<Amenity>[] = [
    {
      key: 'name',
      header: 'Tên',
      rowHeader: true,
      render: (amenity) => (
        <div className="flex items-center gap-3">
          <RoomGallery
            compact
            images={
              amenity.images?.length ? amenity.images : amenity.iconUrl ? [amenity.iconUrl] : []
            }
            name={amenity.name}
          />
          <span className="min-w-24 max-w-48 break-words">{amenity.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      render: (amenity) => (
        <span
          className="block min-w-32 max-w-64 truncate text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
          title={amenity.description || undefined}
          aria-label={amenity.description || undefined}
          tabIndex={amenity.description ? 0 : undefined}
        >
          {amenity.description || 'Chưa có mô tả'}
        </span>
      ),
    },
    {
      key: 'roomTypes',
      header: 'Gắn vào Room Type',
      render: (amenity) => (
        <div className="min-w-40 max-w-80">
          <RoomTypeChips roomTypes={amenity.roomTypes} />
        </div>
      ),
    },
    { key: 'roomTypeCount', header: 'Số loại phòng', className: 'text-right' },
    {
      key: 'isActive',
      header: 'Trạng thái',
      render: (amenity) => (
        <Badge tone={amenity.isActive ? 'success' : 'neutral'}>
          {amenity.isActive ? 'Đang hoạt động' : 'Ngừng'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right',
      render: (amenity) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={'Sửa tiện nghi ' + amenity.name}
          onClick={() => {
            setSuccess(false)
            setEditor({ id: amenity.id })
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
        title="Quản lý tiện nghi"
        subtitle="Tiện nghi hiển thị trên phòng và trang web."
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
            Thêm tiện nghi
          </Button>
        }
      />
      {success && <Alert tone="success">Đã lưu tiện nghi.</Alert>}
      {editor && (
        <AmenityEditor
          id={editor.id}
          onClose={() => setEditor(null)}
          onSuccess={() => {
            setEditor(null)
            setSuccess(true)
          }}
        />
      )}
      {amenities.isPending && (
        <p role="status" className="sr-only">
          Đang tải tiện nghi…
        </p>
      )}
      {amenities.isError && (
        <div className="mb-4 space-y-3">
          <Alert tone="danger">{getErrorMessage(amenities.error)}</Alert>
          <Button
            type="button"
            variant="outline"
            disabled={amenities.isFetching}
            onClick={() => void amenities.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}
      <div role="search" aria-label="Lọc tiện nghi" className="[&_tbody_tr]:hover:bg-surface/50">
        <DataTable
          rows={amenities.isError ? [] : (amenities.data?.items ?? [])}
          columns={columns}
          loading={amenities.isPending}
          caption="Danh sách tiện nghi"
          scrollLabel="Danh sách tiện nghi, cuộn ngang để xem đủ cột"
          searchValue={search}
          onSearchChange={setSearch}
          searchAriaLabel="Tìm theo tên"
          searchPlaceholder="Nhập tên tiện nghi"
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
              <option value="true">Đang hoạt động</option>
              <option value="false">Ngừng</option>
            </NativeSelect>
          }
          page={query.page}
          totalPages={pages}
          onPageChange={(page) => setQuery((previous) => ({ ...previous, page }))}
          paginationDisabled={amenities.isFetching}
          paginationLabel="Phân trang tiện nghi"
          paginationSummary={<span aria-live="polite">{amenities.data?.total ?? 0} tiện nghi</span>}
          empty={
            <div role="status">
              <EmptyState
                icon={SearchX}
                title={
                  amenities.isError
                    ? 'Không tải được danh sách tiện nghi.'
                    : filtered
                      ? 'Không có kết quả khớp bộ lọc.'
                      : 'Chưa có tiện nghi nào.'
                }
              />
            </div>
          }
        />
      </div>
    </PageContainer>
  )
}
