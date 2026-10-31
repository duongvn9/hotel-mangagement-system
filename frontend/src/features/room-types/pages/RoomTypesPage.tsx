import { RoomGallery } from '@/components/AssetImage'
import { useEffect, useState } from 'react'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { AmenityChips } from '../components/AmenityChips'
import { useRoomTypes } from '../hooks'
import type { RoomTypeQuery } from '../api'
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

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Quản trị</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Quản lý loại phòng</h1>
        <p className="mt-2 text-sm text-stone-700">
          Thông tin loại phòng và trạng thái mở đặt phòng.
        </p>
      </div>
      {success && <Alert tone="success">Đã lưu loại phòng. Danh sách đã được cập nhật.</Alert>}
      <Button
        onClick={() => {
          setSuccess(false)
          setEditor({ id: null })
        }}
      >
        Thêm loại phòng
      </Button>
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
      <div role="search" aria-label="Lọc loại phòng" className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Tìm theo tên"
          type="search"
          maxLength={100}
          value={search}
          placeholder="Nhập tên loại phòng"
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Trạng thái"
          value={query.isActive === undefined ? '' : String(query.isActive)}
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'true', label: 'Có thể đặt' },
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
      {isPending && <p role="status">Đang tải loại phòng…</p>}
      {isError && (
        <div className="space-y-3">
          <Alert tone="danger">{getErrorMessage(error)}</Alert>
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            Thử lại
          </Button>
        </div>
      )}
      {!isError && data && (
        <>
          {data.items.length === 0 ? (
            <p
              role="status"
              className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700"
            >
              {filtered ? 'Không có loại phòng khớp bộ lọc.' : 'Chưa có dữ liệu loại phòng.'}
            </p>
          ) : (
            <div
              role="region"
              aria-label="Danh sách loại phòng, cuộn ngang để xem đủ cột"
              tabIndex={0}
              className="max-w-full overflow-x-auto rounded-lg border border-stone-300 bg-white"
            >
              <table className="w-full min-w-[800px] text-left text-sm">
                <caption className="sr-only">Danh sách loại phòng</caption>
                <thead className="bg-stone-200 text-xs text-stone-700 uppercase">
                  <tr>
                    {[
                      'Tên',
                      'Mô tả',
                      'Người lớn',
                      'Trẻ em',
                      'Giá',
                      'Tiện nghi',
                      'Trạng thái',
                      'Thao tác',
                    ].map((name, index) => (
                      <th
                        key={name}
                        scope="col"
                        className={`px-4 py-4 ${[2, 3, 4].includes(index) ? 'text-right' : ''}`}
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((roomType) => (
                    <tr key={roomType.id} className="border-t border-stone-300 hover:bg-cream-50">
                      <th scope="row" className="px-4 py-4 font-semibold">
                        <RoomGallery images={roomType.images} name={roomType.name} />
                        {roomType.name}
                      </th>
                      <td className="max-w-64 px-4 py-4 break-words text-stone-700">
                        {roomType.description || 'Chưa có mô tả'}
                      </td>
                      <td className="px-4 py-4 text-right">{roomType.adultCapacity}</td>
                      <td className="px-4 py-4 text-right">{roomType.childCapacity}</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        {money.format(roomType.basePrice)}
                      </td>
                      <td className="max-w-72 px-4 py-4">
                        <AmenityChips amenities={roomType.amenities} />
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={roomType.availableForBooking ? 'success' : 'neutral'}>
                          {roomType.availableForBooking ? 'Có thể đặt' : 'Ngừng đặt'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Button
                          variant="secondary"
                          aria-label={`Sửa ${roomType.name}`}
                          onClick={() => {
                            setSuccess(false)
                            setEditor({ id: roomType.id })
                          }}
                        >
                          Sửa
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label="Phân trang loại phòng"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-stone-700" aria-live="polite">
              {data.total} loại phòng · Trang {query.page}/{pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={query.page <= 1 || isFetching}
                onClick={() => setQuery((previous) => ({ ...previous, page: previous.page - 1 }))}
              >
                Trang trước
              </Button>
              <Button
                variant="secondary"
                disabled={query.page >= pages || isFetching}
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
