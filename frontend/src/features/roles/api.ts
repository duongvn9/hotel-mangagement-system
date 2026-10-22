import { api } from '@/lib/api-client'

export interface RoleItem {
  id: string
  code: string
  name: string
  description?: string
  isSystem: boolean
  isActive: boolean
  permissions: string[]
  userCount: number
}

export interface PermissionItem {
  code: string
  description: string
}

export interface CreateRoleInput {
  code: string
  name: string
  description?: string
}

export type UpdateRoleInput = Partial<Pick<RoleItem, 'name' | 'description' | 'isActive'>>

/** UC44 */
export const listRoles = async () => (await api.get<RoleItem[]>('/roles')).data

export const listPermissions = async () => (await api.get<PermissionItem[]>('/permissions')).data

/** UC46 */
export const createRole = async (input: CreateRoleInput) =>
  (await api.post<RoleItem>('/roles', input)).data

export const updateRole = async (id: string, input: UpdateRoleInput) =>
  (await api.patch<RoleItem>(`/roles/${id}`, input)).data

/** UC45 */
export const setRolePermissions = async (id: string, permissions: string[]) =>
  (await api.put<RoleItem>(`/roles/${id}/permissions`, { permissions })).data
