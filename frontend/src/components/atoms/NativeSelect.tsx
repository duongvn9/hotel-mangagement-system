import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Ô chọn dùng thẻ `<select>` gốc, tạo kiểu giống `SelectTrigger` của Radix.
 * Dùng khi cần `fireEvent.change` hoặc một control gửi kèm form gốc; danh sách
 * dài hoặc cần giao diện popover thì dùng `Select` (Radix) ở molecules.
 */
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentPropsWithoutRef<'select'>
>(({ className, children, ...props }, ref) => (
  <div className="relative w-full">
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full cursor-pointer appearance-none items-center rounded-md border border-input bg-transparent px-3 py-2 pr-8 text-sm whitespace-nowrap shadow-sm ring-offset-background focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-50" />
  </div>
))
NativeSelect.displayName = 'NativeSelect'
