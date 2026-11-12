import { api } from '@/lib/api-client'
import { normalizeOrderQuery, type OrderQuery, type ServiceOrder } from './api'

export interface StaffServiceOrder extends ServiceOrder {
  intakeMode?: 'UNPERFORMED' | 'COMPLETED_ON_SITE'
  intakeRole?: string
  reportedByName?: string | null
  createdByName?: string | null
  actualPerformerName?: string | null
  roomNumber?: string | null
  createdBy?: string
  reportedBy?: string
  requesterName?: string | null
  roomId?: string | null
  actualPerformerId?: string | null
  actualCompletedAt?: string | null
  completionDetails?: string | null
  customer: { id: string | null; fullName: string | null }
  booking: {
    code: string
    status: string
    checkIn: string
    checkOut: string
    roomNumbers?: string[]
  } | null
  feeRequired: boolean
  billingStatus: 'NOT_REQUIRED' | 'PENDING' | 'BILLED'
  review?: {
    decision: 'ACCEPT' | 'REJECT'
    reason?: string
    reviewedBy: string
    reviewedByName?: string | null
    reviewedAt: string
  }
  acceptanceRecovery?: {
    decision: 'REJECT'
    action?: 'ABANDON_EXPIRED'
    actorRole?: 'RECEPTIONIST'
    previousReviewStatus?: 'ACCEPTING'
    resultingReviewStatus?: 'ABANDONED'
    reason: string
    rejectionReason: string
    actor: string
    at: string
    evidence?: {
      chargeExpected: boolean
      sourceChargeAbsent: boolean
      taskAbsent: boolean
      bookingStatus?: string
      checkIn?: string
      checkOut?: string
      requestedTime?: string
      reviewedBy?: string
      reviewedAt?: string
      reviewDecision?: string
      reviewReason?: string
      quantity?: number
      unitPriceVND?: number
      amount?: number
    }
  }
  invoiceId?: string
  billedAt?: string
  assignmentIntent?: AssignmentInput
  task?: {
    id: string
    status: string
    assigneeId: string
    assigneeName?: string | null
    assignedAt: string
    dueAt?: string
    completedAt?: string
    reassignments?: {
      requestId: string
      actorId: string
      previousAssigneeId: string
      assigneeId: string
      reason: string
      at: string
    }[]
  } | null
}
export interface AssignmentInput {
  assigneeId: string
  dueAt?: string
  recoveryReason?: string
}
export interface ServiceAssignee {
  id: string
  displayName: string
  role: string
}
export async function getServiceAssignees(id: string) {
  return (
    await api.get<{ items: ServiceAssignee[]; recoveryAllowed?: boolean }>(
      `/service-orders/${encodeURIComponent(id)}/assignees`,
    )
  ).data
}
export async function assignServiceOrder(id: string, input: AssignmentInput) {
  const body: AssignmentInput = {
    assigneeId: input.assigneeId,
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    ...(input.recoveryReason !== undefined ? { recoveryReason: input.recoveryReason } : {}),
  }
  return (
    await api.post<StaffServiceOrder>(`/service-orders/${encodeURIComponent(id)}/assignment`, body)
  ).data
}
export function billingLabel(order: StaffServiceOrder) {
  if (order.billingStatus === 'BILLED') return 'Đã ghi vào hóa đơn · không xác nhận thanh toán'
  if (order.reviewStatus === 'ABANDONED') return 'Không ghi phí · đã dừng kỹ thuật'
  if (order.reviewStatus === 'REJECTED') return 'Không ghi phí · đã từ chối'
  if (!order.feeRequired) return 'Không tính phí'
  if (order.billingStatus === 'PENDING') return 'Chờ ghi phí vào hóa đơn'
  return 'Chưa ghi phí'
}
export interface ReviewInput {
  decision: 'ACCEPT' | 'REJECT'
  reason?: string
  recoveryAction?: 'ABANDON_EXPIRED'
  recoveryReason?: string
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
  const recoveryReason = input.recoveryReason?.trim()
  if (input.recoveryAction !== undefined || input.recoveryReason !== undefined) {
    if (
      input.recoveryAction !== 'ABANDON_EXPIRED' ||
      input.decision !== 'REJECT' ||
      !recoveryReason ||
      recoveryReason.length > 2000
    )
      throw new Error(
        'Nhập lý do công khai và lý do khôi phục nội bộ (tối đa 2000 ký tự mỗi lý do).',
      )
  }
  const body: ReviewInput = {
    decision: input.decision,
    ...(input.reason !== undefined ? { reason } : {}),
    ...(input.recoveryAction ? { recoveryAction: input.recoveryAction, recoveryReason } : {}),
  }
  return (
    await api.patch<StaffServiceOrder>(`/service-orders/${encodeURIComponent(id)}/review`, body)
  ).data
}
