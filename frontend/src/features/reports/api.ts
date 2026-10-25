import { api } from '@/lib/api-client'
export type PaymentMethod = 'VNPAY' | 'CASH'
export type PaymentPurpose = 'DEPOSIT' | 'FINAL'
export interface RevenueQuery {
  from: string
  to: string
  granularity: 'day' | 'month'
  method?: PaymentMethod
  purpose?: PaymentPurpose
}
export interface RevenueReport {
  period: { from: string; to: string; timezone: string; granularity: 'day' | 'month' }
  totals: {
    successCount: number
    successAmount: number
    refunds: { count: number; amount: number } | null
    refundsSupported: boolean
    netAmount: number | null
    failedCount: number
    cancelledCount: number
    pendingCount: number
    anomalies: { count: number }
  }
  byMethod: { method: string; successCount: number; successAmount: number }[]
  byPurpose: { purpose: string; successCount: number; successAmount: number }[]
  series: { bucket: string; successCount: number; successAmount: number }[]
  generatedAt: string
}
export const getRevenueReport = async (query: RevenueQuery) =>
  (await api.get<RevenueReport>('/reports/revenue', { params: query })).data
