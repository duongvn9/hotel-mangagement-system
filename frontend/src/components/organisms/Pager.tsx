import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../atoms'

/** Điều khiển phân trang "Trang x / y" + nút trước/sau. Dùng chung cho DataTable và danh sách thẻ. */
export function Pager({
  page,
  totalPages,
  onPrev,
  onNext,
  disabled = false,
}: {
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span>
        Trang {page} / {totalPages}
      </span>
      <Button
        size="icon"
        variant="outline"
        className="size-8 rounded-full"
        disabled={disabled || page <= 1}
        onClick={onPrev}
        aria-label="Trang trước"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="size-8 rounded-full"
        disabled={disabled || page >= totalPages}
        onClick={onNext}
        aria-label="Trang sau"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
