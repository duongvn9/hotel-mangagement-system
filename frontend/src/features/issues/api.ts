import { api } from '@/lib/api-client'

export interface IssueInput {
  title: string
  category: string
  description: string
  bookingId: string
  roomId?: string
}

export interface IssueReceipt extends IssueInput {
  id: string
  priority: 'NORMAL'
  status: 'PENDING_REVIEW'
  reportedAt: string
}

export interface IssueRead extends IssueReceipt {
  closedAt?: string
}

export interface IssueDetail extends IssueRead {
  linkedTasks: unknown[]
  linkedTasksAvailable: false
}

export interface IssueQuery {
  status?: 'PENDING_REVIEW'
  priority?: 'NORMAL'
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
    ...(query.status === 'PENDING_REVIEW' ? { status: query.status } : {}),
    ...(query.priority === 'NORMAL' ? { priority: query.priority } : {}),
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
