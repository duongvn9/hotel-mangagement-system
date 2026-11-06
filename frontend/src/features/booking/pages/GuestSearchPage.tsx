import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Input } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
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
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Lễ tân"
        title="Tìm khách"
        subtitle="Tìm theo tên, số điện thoại, email hoặc mã booking."
      />

      <form
        onSubmit={submit}
        className="card-soft flex flex-wrap items-end gap-4 p-5 sm:p-6"
        aria-label="Tra cứu khách"
      >
        <FormField
          label="Tìm khách"
          htmlFor="guest-search-input"
          error={formError}
          className="min-w-64 flex-1"
        >
          <Input
            id="guest-search-input"
            placeholder="Tên, email, số điện thoại hoặc mã booking"
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </FormField>
        <Button type="submit" disabled={search.isFetching} className="rounded-full">
          Tìm
        </Button>
      </form>

      {search.isError && <Alert tone="danger">{getErrorMessage(search.error)}</Alert>}

      {!query ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            Nhập tên, email, số điện thoại hoặc mã booking để tìm khách.
          </p>
        </Panel>
      ) : search.isPending ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : search.data && search.data.items.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Không tìm thấy khách nào phù hợp.</p>
        </Panel>
      ) : (
        search.data && (
          <>
            <ul className="space-y-3">
              {search.data.items.map((guest) => (
                <GuestCard key={guest.email.toLowerCase()} guest={guest} />
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Trang {search.data.page} / {totalPages} · {search.data.total} khách
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((current) => current - 1)}
                  className="rounded-full"
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageNumber >= totalPages}
                  onClick={() => setPageNumber((current) => current + 1)}
                  className="rounded-full"
                >
                  Trang sau
                </Button>
              </div>
            </div>
          </>
        )
      )}
    </PageContainer>
  )
}

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
      className="card-soft flex flex-wrap items-center justify-between gap-4 p-5"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{guest.name}</span>
          {guest.hasAccount && <Badge tone="info">Có tài khoản</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {guest.email} · {guest.phone}
        </p>
        <p className="text-xs text-muted-foreground">
          {guest.totalBookings} booking · {guest.completedStays} lần đã trả phòng
          {guest.lastCheckIn && ` · Nhận phòng gần nhất ${formatDate(guest.lastCheckIn)}`}
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to={`/reception/bookings?${listParams.toString()}`}>Xem booking</Link>
        </Button>
        <Button asChild size="sm" className="rounded-full">
          <Link to={`/reception/booking/new?${createParams.toString()}`}>Tạo booking</Link>
        </Button>
      </div>
    </li>
  )
}
