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
