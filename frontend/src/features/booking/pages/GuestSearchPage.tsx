import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import type { GuestProfile } from '../api'
import { useGuestSearch } from '../hooks'
import { formatDate } from '../utils'

const PAGE_SIZE = 20
const MIN_QUERY_LENGTH = 2

/** UC14 — Search Guest Profile. Lễ tân tìm khách (kể cả khách walk-in chưa có tài khoản) theo tên, email, số điện thoại hoặc mã booking. */
export function GuestSearchPage() {
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [formError, setFormError] = useState('')
  const [pageNumber, setPageNumber] = useState(1)

  const search = useGuestSearch(query ? { q: query, page: pageNumber, limit: PAGE_SIZE } : null)
  const totalPages = Math.max(1, Math.ceil((search.data?.total ?? 0) / PAGE_SIZE))

  function submit(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (text.length < MIN_QUERY_LENGTH) {
      setFormError(`Nhập ít nhất ${MIN_QUERY_LENGTH} ký tự.`)
      return
    }
    setFormError('')
    setQuery(text)
    setPageNumber(1)
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Lễ tân</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Tìm khách</h1>
      </div>

      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-4 rounded-lg border border-stone-300 bg-white p-6"
        aria-label="Tra cứu khách"
      >
        <TextField
          label="Tìm khách"
          placeholder="Tên, email, số điện thoại hoặc mã booking"
          maxLength={100}
          value={draft}
          error={formError}
          onChange={(event) => setDraft(event.target.value)}
          className="min-w-64 flex-1"
        />
        <Button type="submit" loading={search.isFetching}>
          Tìm
        </Button>
      </form>

      {search.isError && <Alert tone="danger">{getErrorMessage(search.error)}</Alert>}

      {!query ? (
        <p className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700">
          Nhập tên, email, số điện thoại hoặc mã booking để tìm khách.
        </p>
      ) : search.isPending ? (
        <p className="text-stone-700">Đang tải…</p>
      ) : search.data && search.data.items.length === 0 ? (
        <p className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700">
          Không tìm thấy khách nào phù hợp.
        </p>
      ) : (
        search.data && (
          <>
            <ul className="space-y-3">
              {search.data.items.map((guest) => (
                <GuestCard key={guest.email.toLowerCase()} guest={guest} />
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-stone-700">
                Trang {search.data.page} / {totalPages} · {search.data.total} khách
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((current) => current - 1)}
                >
                  Trang trước
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pageNumber >= totalPages}
                  onClick={() => setPageNumber((current) => current + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          </>
        )
      )}
    </section>
  )
}

const actionClass =
  'inline-flex h-9 items-center justify-center rounded border border-pearl-900 px-4 text-xs font-semibold tracking-wider text-pearl-900 uppercase hover:bg-pearl-900 hover:text-cream-100'

function GuestCard({ guest }: { guest: GuestProfile }) {
  const createParams = new URLSearchParams({
    guestName: guest.name,
    guestEmail: guest.email,
    guestPhone: guest.phone,
  })
  const listParams = new URLSearchParams({ q: guest.email })
  return (
    <li
      aria-label={guest.name}
      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-stone-300 bg-white p-5"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-pearl-900">{guest.name}</span>
          {guest.hasAccount && <Badge tone="info">Có tài khoản</Badge>}
        </div>
        <p className="text-sm text-stone-700">
          {guest.email} · {guest.phone}
        </p>
        <p className="text-xs text-stone-500">
          {guest.totalBookings} booking · {guest.completedStays} lần đã trả phòng
          {guest.lastCheckIn && ` · Nhận phòng gần nhất ${formatDate(guest.lastCheckIn)}`}
        </p>
      </div>
      <div className="flex gap-3">
        <Link to={`/reception/bookings?${listParams.toString()}`} className={actionClass}>
          Xem booking
        </Link>
        <Link to={`/reception/booking/new?${createParams.toString()}`} className={actionClass}>
          Tạo booking
        </Link>
      </div>
    </li>
  )
}
