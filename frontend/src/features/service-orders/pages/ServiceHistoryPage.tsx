import { useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { dateTime } from '../api'
import {
  useServiceHistory,
  useServiceHistoryDetail,
  type HistoryQuery,
  type ServiceHistory,
} from '../history'

const linkClass = 'inline-flex min-h-11 items-center text-primary underline'
function HistoryError({ error, retry }: { error: unknown; retry: () => void }) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  return (
    <div role="alert" className="space-y-3 rounded border border-danger p-4 text-danger">
      <p>
        {status === 404
          ? 'Không tìm thấy lịch sử hoặc dữ liệu không thuộc tài khoản của bạn.'
          : status === 403
            ? 'Bạn không có quyền xem lịch sử dịch vụ.'
            : 'Không thể tải lịch sử dịch vụ. Vui lòng thử lại.'}
      </p>
      <Button variant="secondary" onClick={retry}>
        Thử lại
      </Button>
    </div>
  )
}
function HistoryResult({ order }: { order: ServiceHistory }) {
  return (
    <div className="space-y-3 rounded border border-stone-300 bg-white p-4 break-words">
      <p>Mã yêu cầu: {order.id}</p>
      <p>Dịch vụ: {order.service.name}</p>
      <p>
        Số lượng: {order.quantity} {order.service.unit}
      </p>
      <p>Thời gian yêu cầu: {dateTime(order.requestedTime)}</p>
      <p>Đã giao: {dateTime(order.task.assignedAt)}</p>
      {order.task.dueAt && <p>Hạn hoàn thành: {dateTime(order.task.dueAt)}</p>}
      <p>Hoàn thành: {dateTime(order.task.completedAt)}</p>
      <h2 className="font-display text-2xl">Kết quả thực hiện</h2>
      <p className="whitespace-pre-wrap">{order.task.workResult || 'Không có kết quả ghi nhận.'}</p>
      <Link className={linkClass} to={`/staff/tasks/${encodeURIComponent(order.task.id)}`}>
        Xem công việc nguồn của tôi
      </Link>
    </div>
  )
}
export function ServiceHistoryPage() {
  const [query, setQuery] = useState<HistoryQuery>({ page: 1, limit: 20 })
  const [keyword, setKeyword] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [validation, setValidation] = useState('')
  const history = useServiceHistory(query)
  function search(event: FormEvent) {
    event.preventDefault()
    if (keyword.trim().length > 100) {
      setValidation('Từ khóa dịch vụ tối đa 100 ký tự.')
      return
    }
    const start = from ? new Date(`${from}T00:00:00`) : undefined
    const end = to ? new Date(`${to}T23:59:59.999`) : undefined
    if (
      (start && !Number.isFinite(start.getTime())) ||
      (end && !Number.isFinite(end.getTime())) ||
      (start && end && start > end)
    ) {
      setValidation('Khoảng ngày hoàn thành không hợp lệ.')
      return
    }
    setValidation('')
    setQuery({
      page: 1,
      limit: query.limit,
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      ...(start ? { from: start.toISOString() } : {}),
      ...(end ? { to: end.toISOString() } : {}),
    })
  }
  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-8">
      <Link className={linkClass} to="/staff/service/dashboard">
        Bảng điều khiển dịch vụ
      </Link>
      <h1 className="font-display text-3xl">Lịch sử thực hiện dịch vụ</h1>
      <p>
        Chỉ xem dịch vụ bạn đã hoàn thành. Lọc theo ngày hoàn thành, bao gồm cả ngày đầu và ngày
        cuối theo giờ địa phương.
      </p>
      <form
        onSubmit={search}
        className="grid gap-4 rounded border border-stone-300 bg-white p-4 sm:grid-cols-2"
      >
        <label>
          Từ khóa dịch vụ
          <input
            className="min-h-11 w-full rounded border border-stone-300 p-2"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            maxLength={100}
          />
        </label>
        <label>
          Hoàn thành từ ngày
          <input
            className="min-h-11 w-full rounded border border-stone-300 p-2"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Hoàn thành đến ngày
          <input
            className="min-h-11 w-full rounded border border-stone-300 p-2"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label>
          Số kết quả mỗi trang
          <select
            className="min-h-11 w-full rounded border border-stone-300 p-2"
            value={query.limit}
            onChange={(event) => setQuery({ ...query, page: 1, limit: Number(event.target.value) })}
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        {validation && <p role="alert">{validation}</p>}
        <Button type="submit" disabled={history.isFetching}>
          Tìm kiếm
        </Button>
      </form>
      <Button
        variant="secondary"
        disabled={history.isFetching}
        onClick={() => void history.refetch()}
      >
        Tải lại lịch sử
      </Button>
      {history.isFetching && <p role="status">Đang tải lịch sử dịch vụ…</p>}
      {history.isError ? (
        <HistoryError error={history.error} retry={() => void history.refetch()} />
      ) : (
        history.data && (
          <>
            {history.data.items.length === 0 ? (
              <p>Không có lịch sử dịch vụ phù hợp.</p>
            ) : (
              <ul className="space-y-4">
                {history.data.items.map((order) => (
                  <li
                    key={order.id}
                    className="space-y-2 rounded border border-stone-300 bg-white p-4 break-words"
                  >
                    <Link
                      className={linkClass}
                      to={`/staff/service-history/${encodeURIComponent(order.id)}`}
                    >
                      {order.service.name}
                    </Link>
                    <p>Mã yêu cầu: {order.id}</p>
                    <p>Hoàn thành: {dateTime(order.task.completedAt)}</p>
                    <p className="whitespace-pre-wrap">{order.task.workResult}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <Button
                variant="secondary"
                disabled={history.isFetching || query.page <= 1}
                onClick={() => setQuery({ ...query, page: query.page - 1 })}
              >
                Trang trước
              </Button>
              <p>
                Trang {history.data.page} · {history.data.total} kết quả
              </p>
              <Button
                variant="secondary"
                disabled={history.isFetching || query.page * query.limit >= history.data.total}
                onClick={() => setQuery({ ...query, page: query.page + 1 })}
              >
                Trang sau
              </Button>
            </div>
          </>
        )
      )}
    </section>
  )
}
export function ServiceHistoryDetailPage() {
  const { id = '' } = useParams()
  const history = useServiceHistoryDetail(id)
  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-8">
      <Link className={linkClass} to="/staff/service-history">
        Quay lại lịch sử dịch vụ
      </Link>
      <h1 className="font-display text-3xl">Chi tiết lịch sử dịch vụ</h1>
      <p>Chỉ xem kết quả đã hoàn thành.</p>
      {history.isPending && <p role="status">Đang tải lịch sử dịch vụ…</p>}
      {history.isError ? (
        <HistoryError error={history.error} retry={() => void history.refetch()} />
      ) : (
        history.data && <HistoryResult order={history.data} />
      )}
    </section>
  )
}
