import { api } from '@/lib/api-client'

export interface IssueInput {
  title: string
  category: string
  description: string
  bookingId: string
  roomId?: string
}

export const issueStatuses = [
  'PENDING_REVIEW',
  'REVIEWED',
  'CONCLUDED',
  'ASSIGNING',
  'ASSIGNED',
  'CLOSED',
] as const
export const issuePriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
export type IssueStatus = (typeof issueStatuses)[number]
export type IssuePriority = (typeof issuePriorities)[number]
export type HandlingCategory = 'SERVICE' | 'OPERATIONS'

export interface IssueReceipt extends IssueInput {
  id: string
  priority: IssuePriority
  status: IssueStatus
  reportedAt: string
}

export interface IssueRead extends IssueReceipt {
  handlingCategory?: HandlingCategory
  needsStaffAction?: boolean
  reviewedAt?: string
  concludedAt?: string
  reviewedBy?: string
  closedAt?: string
  closedBy?: string
  closureConclusion?: string
  reviewNotes?: string
  assignmentRequestedBy?: string
  assignmentRequestedAt?: string
  assigneeId?: string
  dueAt?: string
  assignedAt?: string
}

export interface LinkedIssueTask {
  id: string
  title: string
  taskType: string
  priority: string
  status: string
  assigneeId: string
  assignedAt: string
  dueAt?: string
  completedAt?: string
}

export interface IssueDetail extends IssueRead {
  linkedTasks: LinkedIssueTask[]
  linkedTasksAvailable: boolean
}

export interface ReviewIssueInput {
  handlingCategory: HandlingCategory
  priority: IssuePriority
  needsStaffAction: boolean
  notes?: string
}

export interface AssignmentInput {
  assigneeId: string
  dueAt?: string
}

function validIssueDate(value?: string) {
  return Boolean(value && Number.isFinite(new Date(value).getTime()))
}

export function canCloseIssue(issue: IssueDetail) {
  if (issue.closedAt || issue.closedBy || issue.closureConclusion !== undefined) return false
  const reviewed = Boolean(
    issue.reviewedBy &&
    validIssueDate(issue.reviewedAt) &&
    (issue.handlingCategory === 'SERVICE' || issue.handlingCategory === 'OPERATIONS'),
  )
  if (!reviewed) return false
  if (issue.status === 'CONCLUDED' && issue.needsStaffAction === false) {
    return Boolean(
      validIssueDate(issue.concludedAt) &&
      new Date(issue.concludedAt!).getTime() >= new Date(issue.reviewedAt!).getTime() &&
      issue.linkedTasks.length === 0,
    )
  }
  return (
    issue.status === 'ASSIGNED' &&
    issue.needsStaffAction === true &&
    issue.linkedTasksAvailable &&
    issue.linkedTasks.length === 1 &&
    issue.linkedTasks.every(
      (task) => task.status === 'COMPLETED' && validIssueDate(task.completedAt),
    )
  )
}

export interface CloseIssueInput {
  conclusion: string
}

export async function closeIssue(id: string, input: CloseIssueInput): Promise<IssueDetail> {
  const conclusion = input.conclusion.trim()
  if (!conclusion || conclusion.length > 2000) throw new Error('Kết luận không hợp lệ.')
  return (await api.post<IssueDetail>(`/issues/${encodeURIComponent(id)}/close`, { conclusion }))
    .data
}

export interface IssueAssignee {
  id: string
  displayName: string
  role: string
}

export async function reviewIssue(id: string, input: ReviewIssueInput): Promise<IssueDetail> {
  return (await api.patch<IssueDetail>(`/issues/${encodeURIComponent(id)}/review`, input)).data
}

export async function getIssueAssignees(id: string): Promise<{ items: IssueAssignee[] }> {
  return (await api.get<{ items: IssueAssignee[] }>(`/issues/${encodeURIComponent(id)}/assignees`))
    .data
}

export async function assignIssue(id: string, input: AssignmentInput): Promise<IssueDetail> {
  return (await api.post<IssueDetail>(`/issues/${encodeURIComponent(id)}/assignment`, input)).data
}

export interface IssueQuery {
  status?: IssueStatus
  priority?: IssuePriority
  category?: string
  keyword?: string
  page: number
  limit: number
}

export interface IssueList {
  items: IssueRead[]
  total: number
  page: number
  limit: number
}

export function normalizeIssueQuery(query: IssueQuery): IssueQuery {
  return {
    page: Number.isInteger(query.page) ? Math.min(10000, Math.max(1, query.page)) : 1,
    limit: Number.isInteger(query.limit) ? Math.min(100, Math.max(1, query.limit)) : 20,
    ...(query.status && issueStatuses.includes(query.status) ? { status: query.status } : {}),
    ...(query.priority && issuePriorities.includes(query.priority)
      ? { priority: query.priority }
      : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.keyword ? { keyword: query.keyword } : {}),
  }
}

export async function listIssues(query: IssueQuery): Promise<IssueList> {
  return (await api.get<IssueList>('/issues', { params: normalizeIssueQuery(query) })).data
}

export async function getIssue(id: string): Promise<IssueDetail> {
  return (await api.get<IssueDetail>(`/issues/${encodeURIComponent(id)}`)).data
}

export type IssueErrors = Partial<Record<keyof IssueInput, string>>

export function validateIssue(input: IssueInput): IssueErrors {
  const errors: IssueErrors = {}
  for (const [key, label, limit] of [
    ['title', 'tiêu đề', 200],
    ['category', 'nhóm sự cố', 100],
    ['description', 'mô tả', 5000],
  ] as const) {
    const value = input[key].trim()
    if (!value) errors[key] = `Vui lòng cung cấp ${label}.`
    else if (value.length > limit) errors[key] = `Nội dung tối đa ${limit} ký tự.`
  }
  if (!/^[a-f\d]{24}$/i.test(input.bookingId.trim())) {
    errors.bookingId = 'Vui lòng nhập mã đặt phòng gồm 24 ký tự từ 0–9 và a–f.'
  }
  if (input.roomId?.trim() && !/^[a-f\d]{24}$/i.test(input.roomId.trim())) {
    errors.roomId = 'Mã phòng phải gồm 24 ký tự từ 0–9 và a–f.'
  }
  return errors
}

export async function reportIssue(input: IssueInput): Promise<IssueReceipt> {
  if ('serviceOrderId' in input || Object.keys(validateIssue(input)).length) {
    throw new Error('Thông tin báo sự cố không hợp lệ.')
  }
  const body: IssueInput = {
    title: input.title.trim(),
    category: input.category.trim(),
    description: input.description.trim(),
    bookingId: input.bookingId.trim(),
    ...(input.roomId?.trim() ? { roomId: input.roomId.trim() } : {}),
  }
  return (await api.post<IssueReceipt>('/issues', body)).data
}
