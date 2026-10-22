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
