import { api } from '@/lib/api-client'

export interface Account {
  id: string
  email: string
  fullName: string
  phone?: string
  role: string
  isActive: boolean
  emailVerified: boolean
  hasFirebaseAccount: boolean
  createdAt?: string
}

export interface AccountQuery {
  search?: string
  role?: string
  isActive?: 'true' | 'false'
  page: number
  limit: number
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface CreateAccountInput {
  email: string
  fullName: string
  phone?: string
  role: string
  password: string
}

export type UpdateAccountInput = Partial<Pick<Account, 'fullName' | 'phone' | 'role' | 'isActive'>>

/** UC42 */
export const listAccounts = async (query: AccountQuery) =>
  (await api.get<Page<Account>>('/users', { params: query })).data

/** UC43 */
export const createAccount = async (input: CreateAccountInput) =>
  (await api.post<Account>('/users', input)).data

export const updateAccount = async (id: string, input: UpdateAccountInput) =>
  (await api.patch<Account>(`/users/${id}`, input)).data
