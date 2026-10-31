import { api } from '@/lib/api-client'

/** Mã role, khớp backend/src/common/constants/role.enum.ts. */
export const Role = {
  Customer: 'CUSTOMER',
  Receptionist: 'RECEPTIONIST',
  ServiceStaff: 'SERVICE_STAFF',
  OperationsStaff: 'OPERATIONS_STAFF',
  Manager: 'MANAGER',
} as const

export const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'Khách hàng',
  RECEPTIONIST: 'Lễ tân',
  SERVICE_STAFF: 'Nhân viên dịch vụ',
  OPERATIONS_STAFF: 'Nhân viên vận hành',
  MANAGER: 'Quản lý',
}

export interface Me {
  avatarUrl?: string
  id: string
  email: string
  fullName: string
  phone?: string
  role: string
  permissions: string[]
}

export interface DevAccount {
  avatarUrl?: string
  id: string
  email: string
  fullName: string
  role: string
}

export const getMe = async () => (await api.get<Me>('/auth/me')).data

export const getDevAccounts = async () => (await api.get<DevAccount[]>('/auth/dev-accounts')).data

export interface ProfileInput {
  avatarUrl?: string
  fullName: string
  phone?: string
}

/** UC01: tạo tài khoản HMS bằng ID token của tài khoản Firebase vừa tạo. */
export const registerAccount = async (idToken: string, input: ProfileInput) =>
  (await api.post('/auth/register', input, { headers: { Authorization: `Bearer ${idToken}` } }))
    .data

/** UC04 */
export const updateProfile = async (input: Partial<ProfileInput>) =>
  (await api.patch('/users/me', input)).data
