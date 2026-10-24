import { useEffect, useState } from 'react'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
import { getErrorMessage } from '@/lib/api-client'
import type { ServiceQuery } from '../api'
import { useServices } from '../hooks'
import { ServicePrice } from '../components/ServicePrice'

export function ServicesPage() {
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
  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Quản trị</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Quản lý dịch vụ</h1>
        <p className="mt-2 text-sm text-stone-700">
          Thông tin, thiết lập tính phí và trạng thái dịch vụ.
        </p>
      </div>
      <div role="search" aria-label="Lọc dịch vụ" className="grid gap-4 md:grid-cols-3">
        <TextField
          label="Tìm theo tên"
          type="search"
          maxLength={100}
          value={search}
          placeholder="Nhập tên dịch vụ"
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Tính phí"
          value={query.billable === undefined ? '' : String(query.billable)}
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'true', label: 'Tính phí' },
            { value: 'false', label: 'Miễn phí' },
          ]}
          onChange={(event) => filter('billable', event.target.value)}
        />
        <SelectField
          label="Trạng thái"
          value={query.isActive === undefined ? '' : String(query.isActive)}
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'true', label: 'Đang hoạt động' },
            { value: 'false', label: 'Ngừng' },
          ]}
          onChange={(event) => filter('isActive', event.target.value)}
        />
      </div>
      {services.isPending && <p role="status">Đang tải dịch vụ…</p>}
      {services.isError && (
        <div className="space-y-3">
          <Alert tone="danger">{getErrorMessage(services.error)}</Alert>
          <Button
            variant="secondary"
            disabled={services.isFetching}
            onClick={() => void services.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}
      {!services.isError && services.data && (
        <>
          {!services.data.items.length ? (
            <p
              role="status"
              className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700"
            >
              {filtered ? 'Không có kết quả khớp bộ lọc.' : 'Chưa có dịch vụ nào.'}
            </p>
          ) : (
            <div
              role="region"
              aria-label="Danh sách dịch vụ, cuộn ngang để xem đủ cột"
              tabIndex={0}
              className="max-w-full overflow-x-auto rounded-lg border border-stone-300 bg-white"
            >
              <table className="w-full min-w-[800px] text-left text-sm">
                <caption className="sr-only">Danh sách dịch vụ</caption>
                <thead className="bg-stone-200 text-xs text-stone-700 uppercase">
                  <tr>
                    {['Tên', 'Mô tả', 'Tính phí', 'Giá', 'Trạng thái'].map((name, index) => (
                      <th
                        scope="col"
                        key={name}
                        className={`px-4 py-4 ${index === 3 ? 'text-right' : ''}`}
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {services.data.items.map((service) => (
                    <tr key={service.id} className="border-t border-stone-300 hover:bg-cream-50">
                      <th scope="row" className="px-4 py-4 font-semibold">
                        {service.name}
                      </th>
                      <td className="px-4 py-4">
                        <span
                          className="block max-w-64 truncate text-stone-700"
                          title={service.description || undefined}
                          aria-label={service.description || undefined}
                          tabIndex={service.description ? 0 : undefined}
                        >
                          {service.description || 'Chưa có mô tả'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={service.billable ? 'info' : 'neutral'}>
                          {service.billable ? 'Tính phí' : 'Miễn phí'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ServicePrice price={service.price} unit={service.unit} />
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={service.isActive ? 'success' : 'neutral'}>
                          {service.isActive ? 'Đang hoạt động' : 'Ngừng'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label="Phân trang dịch vụ"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p aria-live="polite" className="text-sm text-stone-700">
              {services.data.total} dịch vụ · Trang {query.page}/{pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={query.page <= 1 || services.isFetching}
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page - 1 }))}
              >
                Trang trước
              </Button>
              <Button
                variant="secondary"
                disabled={query.page >= pages || services.isFetching}
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
