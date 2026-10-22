import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

interface Health {
  status: string
}

/** Ví dụ gọi API bằng TanStack Query: hiển thị backend có đang chạy không. */
export function ApiStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<Health>('/health')).data,
  })

  const label = isPending ? 'Đang kiểm tra…' : isError ? 'Mất kết nối' : 'Đang chạy'
  const tone = isPending
    ? 'bg-stone-200 text-stone-700'
    : isError || data?.status !== 'ok'
      ? 'bg-danger-bg text-danger'
      : 'bg-success-bg text-success'

  return (
    <span
      className={`inline-flex items-center gap-2 rounded px-3 py-1 text-sm font-medium ${tone}`}
    >
      Backend API: {label}
    </span>
  )
}
