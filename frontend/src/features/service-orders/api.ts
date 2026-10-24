import { api } from '@/lib/api-client'

export const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
export const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN')

export const reviewStatuses = ['PENDING_REVIEW', 'ACCEPTING', 'ACCEPTED', 'REJECTED'] as const
export const reviewLabels: Record<(typeof reviewStatuses)[number], string> = {
  PENDING_REVIEW: 'Chờ duyệt',
  ACCEPTING: 'Đang chấp nhận · chờ hoàn tất ghi phí',
  ACCEPTED: 'Đã chấp nhận',
  REJECTED: 'Đã từ chối',
}
export const executionStatuses = [
  'NOT_STARTED',
  'ASSIGNING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
] as const
export const executionLabels: Record<(typeof executionStatuses)[number], string> = {
  NOT_STARTED: 'Chưa bắt đầu',
  ASSIGNING: 'Đang phân công',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Đã hoàn thành',
}
export interface OrderContext {
  id: string
  code: string
  checkIn: string
  checkOut: string
}
export interface CatalogService {
  id: string
  name: string
  description: string
  unit: string
  billable: boolean
  unitPriceVND: number
}
export interface OrderInput {
  bookingId: string
  serviceId: string
  quantity: number
  requestedTime?: string
  notes?: string
  requestId?: string
}
export interface ServiceOrder extends OrderInput {
  id: string
  service: { name: string; unit: string }
  unitPriceVND: number
  amount: number
  requestedTime: string
  reviewStatus: (typeof reviewStatuses)[number]
  executionStatus: (typeof executionStatuses)[number]
  createdAt: string
}
export interface OrderQuery {
  reviewStatus?: (typeof reviewStatuses)[number]
  executionStatus?: (typeof executionStatuses)[number]
  keyword?: string
  page: number
  limit: number
}
export interface OrderPage {
  items: ServiceOrder[]
  total: number
  page: number
  limit: number
}
export function normalizeOrderQuery(query: OrderQuery): OrderQuery {
  return {
    page: Number.isSafeInteger(query.page) ? Math.min(10000, Math.max(1, query.page)) : 1,
    limit: Number.isSafeInteger(query.limit) ? Math.min(100, Math.max(1, query.limit)) : 20,
    ...(query.reviewStatus && reviewStatuses.includes(query.reviewStatus)
      ? { reviewStatus: query.reviewStatus }
      : {}),
    ...(query.executionStatus && executionStatuses.includes(query.executionStatus)
      ? { executionStatus: query.executionStatus }
      : {}),
    ...(query.keyword ? { keyword: query.keyword } : {}),
  }
}
export async function getOrderContexts() {
  return (await api.get<{ items: OrderContext[] }>('/service-orders/order-contexts')).data
}
export async function getOrderCatalog() {
  return (await api.get<{ items: CatalogService[] }>('/service-orders/catalog')).data
}
export async function listOrders(query: OrderQuery) {
  return (await api.get<OrderPage>('/service-orders/me', { params: normalizeOrderQuery(query) }))
    .data
}
export async function getOrder(id: string) {
  return (await api.get<ServiceOrder>(`/service-orders/${encodeURIComponent(id)}`)).data
}
export function estimateAmount(service: CatalogService, quantity: number) {
  const price = service.billable ? service.unitPriceVND : 0
  const amount = price * quantity
  return Number.isSafeInteger(quantity) &&
    quantity > 0 &&
    Number.isSafeInteger(price) &&
    price >= 0 &&
    Number.isSafeInteger(amount)
    ? amount
    : null
}
export async function createOrder(input: OrderInput) {
  if (
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 ||
    (input.notes?.trim().length ?? 0) > 2000
  )
    throw new Error('Thông tin yêu cầu không hợp lệ.')
  const body: OrderInput = {
    bookingId: input.bookingId,
    serviceId: input.serviceId,
    quantity: input.quantity,
    ...(input.requestedTime ? { requestedTime: input.requestedTime } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
  }
  return (await api.post<ServiceOrder>('/service-orders', body)).data
}
