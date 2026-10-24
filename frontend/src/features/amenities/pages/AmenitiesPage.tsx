import { useEffect, useState } from 'react'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
import { getErrorMessage } from '@/lib/api-client'
import type { AmenityQuery } from '../api'
import { useAmenities } from '../hooks'
import { RoomTypeChips } from '../components/RoomTypeChips'
export function AmenitiesPage() {
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
  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Quản trị</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Quản lý tiện nghi</h1>
        <p className="mt-2 text-sm text-stone-700">
          Thông tin tiện nghi và các loại phòng đang gắn.
        </p>
      </div>
      <div role="search" aria-label="Lọc tiện nghi" className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Tìm theo tên"
          type="search"
          maxLength={100}
          value={search}
          placeholder="Nhập tên tiện nghi"
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Trạng thái"
          value={query.isActive === undefined ? '' : String(query.isActive)}
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'true', label: 'Đang hoạt động' },
            { value: 'false', label: 'Ngừng' },
          ]}
          onChange={(event) => {
            const value = event.target.value
            setQuery((previous) => ({
              ...previous,
              page: 1,
              isActive: value === '' ? undefined : value === 'true',
            }))
          }}
        />
      </div>
      {amenities.isPending && <p role="status">Đang tải tiện nghi…</p>}
      {amenities.isError && (
        <div className="space-y-3">
          <Alert tone="danger">{getErrorMessage(amenities.error)}</Alert>
          <Button
            variant="secondary"
            disabled={amenities.isFetching}
            onClick={() => void amenities.refetch()}
          >
            Thử lại
          </Button>
        </div>
      )}
      {!amenities.isError && amenities.data && (
        <>
          {!amenities.data.items.length ? (
            <p
              role="status"
              className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700"
            >
              {filtered ? 'Không có kết quả khớp bộ lọc.' : 'Chưa có tiện nghi nào.'}
            </p>
          ) : (
            <div
              role="region"
              aria-label="Danh sách tiện nghi, cuộn ngang để xem đủ cột"
              tabIndex={0}
              className="max-w-full overflow-x-auto rounded-lg border border-stone-300 bg-white"
            >
              <table className="w-full min-w-[800px] text-left text-sm">
                <caption className="sr-only">Danh sách tiện nghi</caption>
                <thead className="bg-stone-200 text-xs text-stone-700 uppercase">
                  <tr>
                    {['Tên', 'Mô tả', 'Gắn vào Room Type', 'Số loại phòng', 'Trạng thái'].map(
                      (name, index) => (
                        <th
                          scope="col"
                          key={name}
                          className={`px-4 py-4 ${index === 3 ? 'text-right' : ''}`}
                        >
                          {name}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {amenities.data.items.map((amenity) => (
                    <tr key={amenity.id} className="border-t border-stone-300 hover:bg-cream-50">
                      <th scope="row" className="px-4 py-4 font-semibold">
                        {amenity.name}
                      </th>
                      <td className="px-4 py-4">
                        <span
                          className="block max-w-64 truncate text-stone-700"
                          title={amenity.description || undefined}
                          aria-label={amenity.description || undefined}
                          tabIndex={amenity.description ? 0 : undefined}
                        >
                          {amenity.description || 'Chưa có mô tả'}
                        </span>
                      </td>
                      <td className="max-w-80 px-4 py-4">
                        <RoomTypeChips roomTypes={amenity.roomTypes} />
                      </td>
                      <td className="px-4 py-4 text-right">{amenity.roomTypeCount}</td>
                      <td className="px-4 py-4">
                        <Badge tone={amenity.isActive ? 'success' : 'neutral'}>
                          {amenity.isActive ? 'Đang hoạt động' : 'Ngừng'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label="Phân trang tiện nghi"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p aria-live="polite" className="text-sm text-stone-700">
              {amenities.data.total} tiện nghi · Trang {query.page}/{pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={query.page <= 1 || amenities.isFetching}
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page - 1 }))}
              >
                Trang trước
              </Button>
              <Button
                variant="secondary"
                disabled={query.page >= pages || amenities.isFetching}
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
