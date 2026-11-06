import { useMemo } from 'react'
import { useMyBookings } from '@/features/booking/hooks'
import { todayISO } from '@/features/booking/utils'
import { useOrders } from '@/features/service-orders/hooks'
import { summarizeBookings } from './overview'

/** Số liệu trang Tổng quan của khách; mỗi nguồn dữ liệu lỗi riêng, không kéo nguồn kia theo. */
export function useCustomerOverview() {
  const bookings = useMyBookings()
  const orders = useOrders({ page: 1, limit: 1 })
  const summary = useMemo(() => summarizeBookings(bookings.data ?? [], todayISO()), [bookings.data])
  return { bookings, serviceOrderCount: orders.data?.total, summary }
}
