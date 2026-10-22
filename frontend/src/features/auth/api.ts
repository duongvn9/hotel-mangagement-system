import { api } from '@/lib/api-client'

/** Mã role, khớp backend/src/common/constants/role.enum.ts. */
export const Role = {
  Customer: 'CUSTOMER',
  Receptionist: 'RECEPTIONIST',
  ServiceStaff: 'SERVICE_STAFF',
  OperationsStaff: 'OPERATIONS_STAFF',
  Manager: 'MANAGER',
} as const

export interface Me {
  id: string
  email: string
  fullName: string
  phone?: string
  role: string
  permissions: string[]
}

export interface DevAccount {
  id: string
  email: string
  fullName: string
  role: string
}

export const getMe = async () => (await api.get<Me>('/auth/me')).data

export const getDevAccounts = async () => (await api.get<DevAccount[]>('/auth/dev-accounts')).data
