import { createContext, useContext } from 'react'
import type { DevAccount, Me } from './api'

export interface AuthContextValue {
  me: Me | null
  status: 'loading' | 'authenticated' | 'anonymous'
  /** true khi chưa cấu hình Firebase: đăng nhập bằng tài khoản seed. */
  isDevMode: boolean
  login(email: string, password: string): Promise<void>
  loginAsDev(account: DevAccount): Promise<void>
  logout(): Promise<void>
  /** Tải lại thông tin người dùng, ví dụ sau khi sửa hồ sơ. */
  refresh(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  return value
}
