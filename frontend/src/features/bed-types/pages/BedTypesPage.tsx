import { useEffect, useState } from 'react'
import { Pencil, Plus, SearchX } from 'lucide-react'
import { Badge, Button, NativeSelect } from '@/components/atoms'
import { Alert, EmptyState } from '@/components/molecules'
import { DataTable, PageContainer, PageHeader, type Column } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import type { BedType, BedTypeQuery } from '../api'
import { useBedTypes } from '../hooks'
import { RoomTypeChips } from '../components/RoomTypeChips'
import { BedTypeEditor } from '../components/BedTypeForm'

export function BedTypesPage() {
  const [editor, setEditor] = useState<{ id: string | null } | null>(null)
  const [success, setSuccess] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState<BedTypeQuery>({ page: 1, limit: 10 })
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
  const bedTypes = useBedTypes(query)
  const filtered = Boolean(query.search || query.isActive !== undefined)
  const pages = bedTypes.data
    ? Math.max(1, Math.ceil(bedTypes.data.total / bedTypes.data.limit))
    : 1
  const columns: Column<BedType>[] = [
    {
      key: 'name',
      header: 'Tên',
      rowHeader: true,
      render: (bedType) => <span className="min-w-24 max-w-48 break-words">{bedType.name}</span>,
    },
    {
      key: 'description',
      header: 'Mô tả',
      render: (bedType) => (
        <span
          className="block min-w-32 max-w-64 truncate text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
          title={bedType.description || undefined}
          aria-label={bedType.description || undefined}
          tabIndex={bedType.description ? 0 : undefined}
        >
          {bedType.description || 'Chưa có mô tả'}
        </span>
      ),
    },
    {
      key: 'roomTypes',
      header: 'Dùng ở loại phòng',
      render: (bedType) => (
        <div className="min-w-40 max-w-80">
          <RoomTypeChips roomTypes={bedType.roomTypes} />
        </div>
      ),
    },
    { key: 'roomTypeCount', header: 'Số loại phòng', className: 'text-right' },
    {
      key: 'isActive',
      header: 'Trạng thái',
      render: (bedType) => (
        <Badge tone={bedType.isActive ? 'success' : 'neutral'}>
          {bedType.isActive ? 'Đang hoạt động' : 'Ngừng'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right',
      render: (bedType) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={'Sửa loại giường ' + bedType.name}
          onClick={() => {
            setSuccess(false)
            setEditor({ id: bedType.id })
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
        title="Quản lý loại giường"
        subtitle="Loại giường dùng để mô tả cấu hình giường của loại phòng và lọc khi tìm phòng."
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
            Thêm loại giường
          </Button>
        }
      />
      {success && <Alert tone="success">Đã lưu loại giường.</Alert>}
      {editor && (
        <BedTypeEditor
          id={editor.id}
          onClose={() => setEditor(null)}
          onSuccess={() => {
            setEditor(null)
            setSuccess(true)
          }}
        />
      )}
      {bedTypes.isPending && (
        <p role="status" className="sr-only">
          Đang tải loại giường…
        </p>
      )}
      {bedTypes.isError && (
        <div className="mb-4 space-y-3">
          <Alert tone="danger">{getErrorMessage(bedTypes.error)}</Alert>
          <Button
            type="button"
            variant="outline"
            disabled={bedTypes.isFetching}
            onClick={() => void bedTypes.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}
      <div role="search" aria-label="Lọc loại giường" className="[&_tbody_tr]:hover:bg-surface/50">
        <DataTable
          rows={bedTypes.isError ? [] : (bedTypes.data?.items ?? [])}
          columns={columns}
          loading={bedTypes.isPending}
          caption="Danh sách loại giường"
          scrollLabel="Danh sách loại giường, cuộn ngang để xem đủ cột"
          searchValue={search}
          onSearchChange={setSearch}
          searchAriaLabel="Tìm theo tên"
          searchPlaceholder="Nhập tên loại giường"
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
          paginationDisabled={bedTypes.isFetching}
          paginationLabel="Phân trang loại giường"
          paginationSummary={
            <span aria-live="polite">{bedTypes.data?.total ?? 0} loại giường</span>
          }
          empty={
            <div role="status">
              <EmptyState
                icon={SearchX}
                title={
                  bedTypes.isError
                    ? 'Không tải được danh sách loại giường.'
                    : filtered
                      ? 'Không có kết quả khớp bộ lọc.'
                      : 'Chưa có loại giường nào.'
                }
              />
            </div>
          }
        />
      </div>
    </PageContainer>
  )
}
