import type { Page } from '@/features/accounts/api'
import { api } from '@/lib/api-client'

export interface FeedbackItem {
  id: string
  bookingId: string
  rating?: number
  content: string
  createdAt: string
  customer: { id: string; fullName: string; email: string } | null
  reply?: {
    content: string
    repliedAt: string
    repliedBy: { id: string; fullName: string } | null
  }
}

export interface FeedbackQuery {
  search?: string
  rating?: number
  replied?: 'true' | 'false'
  page: number
  limit: number
}

/** UC40 */
export const listFeedback = async (query: FeedbackQuery) =>
  (await api.get<Page<FeedbackItem>>('/feedback', { params: query })).data

/** UC41 */
export const replyFeedback = async (id: string, content: string) =>
  (await api.post<FeedbackItem>(`/feedback/${id}/reply`, { content })).data

export interface MyStayFeedback {
  id: string
  rating?: number
  content: string
  createdAt: string
  /** Câu trả lời chính thức của lễ tân (UC41), nếu có. */
  reply?: { content: string; repliedAt: string }
}

export interface MyStay {
  bookingId: string
  code: string
  checkIn: string
  checkOut: string
  /** Phản hồi đã gửi cho lần lưu trú này, null nếu chưa gửi. */
  feedback: MyStayFeedback | null
}

export interface MyStaysResponse {
  items: MyStay[]
}

export interface SubmitFeedbackInput {
  bookingId: string
  /** 1-5 sao, bỏ trống nếu không đánh giá. */
  rating?: number
  content: string
}

/** UC39 — Các lần lưu trú đã trả phòng của khách kèm phản hồi đã gửi và câu trả lời. */
export const getMyStays = async () => (await api.get<MyStaysResponse>('/feedback/mine')).data

/** UC39 — Gửi phản hồi cho một lần lưu trú đã trả phòng (mỗi lần lưu trú một phản hồi). */
export const submitFeedback = async (input: SubmitFeedbackInput) =>
  (await api.post<{ id: string }>('/feedback', input)).data
