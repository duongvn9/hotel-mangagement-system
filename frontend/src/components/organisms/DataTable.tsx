import { Search, SearchX } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { label } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Input, Skeleton } from '../atoms'
import {
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../molecules'
import { Pager } from './Pager'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
  rowHeader?: boolean
}

export interface Filter<T> {
  key: string
  label: string
  options: string[]
  get: (row: T) => string
}

interface DataTableProps<T extends { id: string }> {
  rows: T[]
  columns: Column<T>[]
  search?: (row: T) => string
  filters?: Filter<T>[]
  pageSize?: number
  onRowClick?: (row: T) => void
  toolbar?: ReactNode
  empty?: ReactNode
  loading?: boolean
  /**
   * Chế độ server (tùy chọn). Khi không truyền các prop dưới đây, bảng lọc/tìm/
   * phân trang trên client đúng như cũ. Truyền vào để trang tự điều khiển.
   */
  // Ô tìm kiếm có kiểm soát, gửi khi nhấn Enter.
  searchValue?: string
  onSearchChange?: (value: string) => void
  onSearchSubmit?: () => void
  searchPlaceholder?: string
  searchAriaLabel?: string
  // Khe cho các điều khiển thêm ở bên trái thanh công cụ (ví dụ ô lọc).
  toolbarStart?: ReactNode
  // Phân trang có kiểm soát (page tính từ 1).
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  caption?: string
  scrollLabel?: string
  searchMaxLength?: number
  paginationDisabled?: boolean
  paginationSummary?: ReactNode
  paginationLabel?: string
  showPagination?: boolean
}

const LOADING_ROWS = 4

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  search,
  filters = [],
  pageSize = 8,
  onRowClick,
  toolbar,
  empty,
  loading = false,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Tìm kiếm…',
  searchAriaLabel,
  toolbarStart,
  page,
  totalPages,
  onPageChange,
  caption,
  scrollLabel,
  searchMaxLength,
  paginationDisabled = false,
  paginationSummary,
  paginationLabel,
  showPagination = true,
}: DataTableProps<T>) {
  const [q, setQ] = useState('')
  const [f, setF] = useState<Record<string, string>>({})
  const [clientPage, setClientPage] = useState(0)

  const controlledSearch = onSearchChange !== undefined
  const serverPaged = page !== undefined && totalPages !== undefined && onPageChange !== undefined

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (q && search && !search(r).toLowerCase().includes(q.toLowerCase())) return false
        return filters.every((fl) => !f[fl.key] || f[fl.key] === 'all' || fl.get(r) === f[fl.key])
      }),
    [rows, q, f, search, filters],
  )
  const clientPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const cur = Math.min(clientPage, clientPages - 1)
  const view = serverPaged
    ? rows
    : showPagination
      ? filtered.slice(cur * pageSize, cur * pageSize + pageSize)
      : filtered

  const displayPage = serverPaged ? page! : cur + 1
  const displayPages = serverPaged ? totalPages! : clientPages
  const goPrev = () => (serverPaged ? onPageChange!(page! - 1) : setClientPage(cur - 1))
  const goNext = () => (serverPaged ? onPageChange!(page! + 1) : setClientPage(cur + 1))

  return (
    <div className="card-soft overflow-hidden">
      {(search || controlledSearch || toolbarStart || filters.length > 0 || toolbar) && (
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          {controlledSearch ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                onSearchSubmit?.()
              }}
              className="relative md:w-72"
            >
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchAriaLabel}
                maxLength={searchMaxLength}
                className="h-9 rounded-full bg-surface/60 pl-9"
              />
            </form>
          ) : (
            search && (
              <div className="relative md:w-72">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setClientPage(0)
                  }}
                  placeholder="Tìm kiếm…"
                  className="h-9 rounded-full bg-surface/60 pl-9"
                />
              </div>
            )
          )}
          {toolbarStart}
          {filters.map((fl) => (
            <Select
              key={fl.key}
              value={f[fl.key] ?? 'all'}
              onValueChange={(v) => {
                setF({ ...f, [fl.key]: v })
                setClientPage(0)
              }}
            >
              <SelectTrigger className="h-9 rounded-full md:w-44">
                <SelectValue placeholder={fl.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả: {fl.label.toLowerCase()}</SelectItem>
                {fl.options.map((o) => (
                  <SelectItem key={o} value={o}>
                    {label(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          <div className="flex gap-2 md:ml-auto">{toolbar}</div>
        </div>
      )}
      <div
        role={scrollLabel ? 'region' : undefined}
        aria-label={scrollLabel}
        tabIndex={scrollLabel ? 0 : undefined}
        className={cn(
          'overflow-x-auto',
          scrollLabel && 'focus-visible:outline-2 focus-visible:outline-ring',
        )}
      >
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b bg-surface/40 text-left text-xs tracking-wider text-muted-foreground uppercase">
              {columns.map((c) => (
                <th key={c.key} className={cn('px-4 py-3 font-medium', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: LOADING_ROWS }, (_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-4">
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : view.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onRowClick?.(r)}
                    className={cn(
                      'border-b transition-colors last:border-0',
                      onRowClick && 'cursor-pointer hover:bg-surface/50',
                    )}
                  >
                    {columns.map((c) => {
                      const Cell = c.rowHeader ? 'th' : 'td'
                      return (
                        <Cell
                          key={c.key}
                          scope={c.rowHeader ? 'row' : undefined}
                          className={cn(
                            'px-4 py-3.5 align-middle',
                            c.rowHeader && 'text-left font-medium',
                            c.className,
                          )}
                        >
                          {c.render ? c.render(r) : String(r[c.key as keyof T] ?? '')}
                        </Cell>
                      )
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && view.length === 0 && (
          <div className="p-6">
            {empty ?? (
              <EmptyState
                icon={SearchX}
                title="Không có kết quả phù hợp"
                body="Thử từ khoá khác hoặc bỏ bộ lọc."
              />
            )}
          </div>
        )}
      </div>
      {showPagination && (
        <div
          role={paginationLabel ? 'navigation' : undefined}
          aria-label={paginationLabel}
          className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"
        >
          <span>{paginationSummary ?? (serverPaged ? null : `${filtered.length} kết quả`)}</span>
          <Pager
            page={displayPage}
            totalPages={displayPages}
            onPrev={goPrev}
            onNext={goNext}
            disabled={paginationDisabled}
          />
        </div>
      )}
    </div>
  )
}
