import { api } from '@/lib/api-client'
import { normalizeOrderQuery, type OrderQuery, type ServiceOrder } from './api'

export interface StaffServiceOrder extends ServiceOrder {
  customer: { id: string; fullName: string | null }
  booking: { code: string; status: string; checkIn: string; checkOut: string } | null
  feeRequired: boolean
  billingStatus: 'NOT_REQUIRED' | 'PENDING' | 'BILLED'
  review?: {
    decision: 'ACCEPT' | 'REJECT'
    reason?: string
    reviewedBy: string
    reviewedAt: string
  }
  invoiceId?: string
  billedAt?: string
}
export function billingLabel(order: StaffServiceOrder) {
  if (order.billingStatus === 'BILLED') return 'Đã ghi vào hóa đơn · không xác nhận thanh toán'
  if (order.reviewStatus === 'REJECTED') return 'Không ghi phí · đã từ chối'
  if (!order.feeRequired) return 'Không tính phí'
  if (order.billingStatus === 'PENDING') return 'Chờ ghi phí vào hóa đơn'
  return 'Chưa ghi phí'
}
export interface ReviewInput {
  decision: 'ACCEPT' | 'REJECT'
  reason?: string
}
export interface StaffOrderPage {
  items: StaffServiceOrder[]
  total: number
  page: number
  limit: number
}
export async function listStaffOrders(query: OrderQuery) {
  return (
    await api.get<StaffOrderPage>('/service-orders/requests', {
      params: normalizeOrderQuery(query),
    })
  ).data
}
export async function getStaffOrder(id: string) {
  return (await api.get<StaffServiceOrder>(`/service-orders/requests/${encodeURIComponent(id)}`))
    .data
}
export async function reviewStaffOrder(id: string, input: ReviewInput) {
  const reason = input.reason?.trim()
  if (
    !['ACCEPT', 'REJECT'].includes(input.decision) ||
    (reason?.length ?? 0) > 2000 ||
    (input.decision === 'REJECT' && !reason)
  )
    throw new Error('Lý do từ chối là bắt buộc và lý do tối đa 2000 ký tự.')
  const body: ReviewInput = {
    decision: input.decision,
    ...(input.reason !== undefined ? { reason } : {}),
  }
  return (
    await api.patch<StaffServiceOrder>(`/service-orders/${encodeURIComponent(id)}/review`, body)
  ).data
}
