import { RoomGallery } from '@/components/AssetImage'
import { useEffect, useState } from 'react'
import { Pencil, Plus, SearchX } from 'lucide-react'
import { Badge, Button, NativeSelect } from '@/components/atoms'
import { Alert, EmptyState } from '@/components/molecules'
import { DataTable, PageContainer, PageHeader, type Column } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import type { Service, ServiceQuery } from '../api'
import { useServices } from '../hooks'
import { ServicePrice } from '../components/ServicePrice'
import { ServiceEditor } from '../components/ServiceForm'

export function ServicesPage() {
  const [editor, setEditor] = useState<{ id: string | null } | null>(null)
  const [success, setSuccess] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState<ServiceQuery>({ page: 1, limit: 10 })
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
  const services = useServices(query)
  const filtered = Boolean(
    query.search || query.billable !== undefined || query.isActive !== undefined,
  )
  const pages = services.data
    ? Math.max(1, Math.ceil(services.data.total / services.data.limit))
    : 1
  function filter(field: 'billable' | 'isActive', value: string) {
    setQuery((previous) => ({
      ...previous,
      page: 1,
      [field]: value === '' ? undefined : value === 'true',
    }))
  }
  const columns: Column<Service>[] = [
    {
      key: 'name',
      header: 'Tên',
      rowHeader: true,
      render: (service) => (
        <div className="flex items-center gap-3">
          <RoomGallery
            compact
            images={service.imageUrl ? [service.imageUrl] : []}
            name={service.name}
          />
          <span className="min-w-24 max-w-48 break-words">{service.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      render: (service) => (
        <span
          className="block min-w-32 max-w-64 truncate text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
          title={service.description || undefined}
          aria-label={service.description || undefined}
          tabIndex={service.description ? 0 : undefined}
        >
          {service.description || 'Chưa có mô tả'}
        </span>
      ),
    },
    {
      key: 'billable',
      header: 'Tính phí',
      render: (service) => (
        <Badge tone={service.billable ? 'info' : 'neutral'}>
          {service.billable ? 'Tính phí' : 'Miễn phí'}
        </Badge>
      ),
    },
    {
      key: 'price',
      header: 'Giá',
      className: 'text-right',
      render: (service) => <ServicePrice price={service.price} unit={service.unit} />,
    },
    {
      key: 'isActive',
      header: 'Trạng thái',
      render: (service) => (
        <Badge tone={service.isActive ? 'success' : 'neutral'}>
          {service.isActive ? 'Đang hoạt động' : 'Ngừng'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right',
      render: (service) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Sửa dịch vụ ${service.name}`}
          onClick={() => {
            setSuccess(false)
            setEditor({ id: service.id })
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
        title="Quản lý dịch vụ"
        subtitle="Những dịch vụ khách có thể đặt khi lưu trú."
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
            Thêm dịch vụ
          </Button>
        }
      />
      {success && <Alert tone="success">Đã lưu dịch vụ.</Alert>}
      {editor && (
        <ServiceEditor
          id={editor.id}
          onClose={() => setEditor(null)}
          onSuccess={() => {
            setEditor(null)
            setSuccess(true)
          }}
        />
      )}
      {services.isPending && (
        <p role="status" className="sr-only">
          Đang tải dịch vụ…
        </p>
      )}
      {services.isError && (
        <div className="mb-4 space-y-3">
          <Alert tone="danger">{getErrorMessage(services.error)}</Alert>
          <Button
            type="button"
            variant="outline"
            disabled={services.isFetching}
            onClick={() => void services.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}
      <div role="search" aria-label="Lọc dịch vụ" className="[&_tbody_tr]:hover:bg-surface/50">
        <DataTable
          rows={services.isError ? [] : (services.data?.items ?? [])}
          columns={columns}
          loading={services.isPending}
          caption="Danh sách dịch vụ"
          scrollLabel="Danh sách dịch vụ, cuộn ngang để xem đủ cột"
          searchValue={search}
          onSearchChange={setSearch}
          searchAriaLabel="Tìm theo tên"
          searchPlaceholder="Nhập tên dịch vụ"
          searchMaxLength={100}
          toolbarStart={
            <>
              <NativeSelect
                aria-label="Tính phí"
                className="h-9 rounded-full md:w-44"
                value={query.billable === undefined ? '' : String(query.billable)}
                onChange={(event) => filter('billable', event.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="true">Tính phí</option>
                <option value="false">Miễn phí</option>
              </NativeSelect>
              <NativeSelect
                aria-label="Trạng thái"
                className="h-9 rounded-full md:w-44"
                value={query.isActive === undefined ? '' : String(query.isActive)}
                onChange={(event) => filter('isActive', event.target.value)}
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
          paginationDisabled={services.isFetching}
          paginationLabel="Phân trang dịch vụ"
          paginationSummary={<span aria-live="polite">{services.data?.total ?? 0} dịch vụ</span>}
          empty={
            <div role="status">
              <EmptyState
                icon={SearchX}
                title={
                  services.isError
                    ? 'Không tải được danh sách dịch vụ.'
                    : filtered
                      ? 'Không có kết quả khớp bộ lọc.'
                      : 'Chưa có dịch vụ nào.'
                }
              />
            </div>
          }
        />
      </div>
    </PageContainer>
  )
}
