import { api } from '@/lib/api-client'

export interface ServiceIssueContext {
  taskId: string
  taskTitle: string
  taskStatus: string
  serviceOrderId: string
  service: { id: string; name: string; unit: string }
  booking: { id: string; code: string }
}

export interface ServiceIssueInput {
  title: string
  category: string
  description: string
}

export interface ServiceIssueReceipt extends ServiceIssueInput {
  id: string
  priority: 'NORMAL'
  status: 'PENDING_REVIEW'
  reportedAt: string
  bookingId: string
  serviceOrderId: string
  sourceTaskId: string
  serviceId: string
}

export function normalizeServiceIssue(input: ServiceIssueInput): ServiceIssueInput {
  return {
    title: input.title.trim(),
    category: input.category.trim(),
    description: input.description.trim(),
  }
}

export function validateServiceIssue(input: ServiceIssueInput) {
  const normalized = normalizeServiceIssue(input)
  const errors: Partial<Record<keyof ServiceIssueInput, string>> = {}
  for (const [key, limit] of [
    ['title', 200],
    ['category', 100],
    ['description', 5000],
  ] as const) {
    if (!normalized[key] || normalized[key].length > limit) {
      errors[key] = `Vui lòng nhập từ 1 đến ${limit} ký tự sau khi bỏ khoảng trắng đầu và cuối.`
    }
  }
  return errors
}

export async function getServiceIssueContext(taskId: string): Promise<ServiceIssueContext> {
  return (
    await api.get<ServiceIssueContext>(
      `/issues/service-tasks/${encodeURIComponent(taskId)}/context`,
    )
  ).data
}

export async function reportServiceIssue(
  taskId: string,
  input: ServiceIssueInput,
  requestId: string,
): Promise<ServiceIssueReceipt> {
  return (
    await api.post<ServiceIssueReceipt>(`/issues/service-tasks/${encodeURIComponent(taskId)}`, {
      ...normalizeServiceIssue(input),
      requestId,
    })
  ).data
}
