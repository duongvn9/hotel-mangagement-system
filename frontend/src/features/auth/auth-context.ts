import { createContext, useContext } from 'react'
import type { DevAccount, Me, ProfileInput } from './api'

export interface AuthContextValue {
  me: Me | null
  status: 'loading' | 'authenticated' | 'anonymous'
  /** true khi chưa cấu hình Firebase: đăng nhập bằng tài khoản seed. */
  isDevMode: boolean
  /** Tài khoản Firebase đã có đăng nhập email/mật khẩu (false nếu chỉ đăng nhập Google). */
  hasPassword: boolean
  login(email: string, password: string): Promise<void>
  loginAsDev(account: DevAccount): Promise<void>
  /** Đăng nhập bằng Google; lần đầu thì tự tạo tài khoản Customer bằng tên Google. */
  loginWithGoogle(): Promise<void>
  /** UC01: tạo tài khoản, gửi email xác minh rồi đăng xuất (phải xác minh mới đăng nhập được). */
  register(input: ProfileInput & { email: string; password: string }): Promise<void>
  /** Gửi email chứa link đặt lại mật khẩu (Firebase). */
  sendPasswordReset(email: string): Promise<void>
  /** Có `currentPassword` thì đổi mật khẩu; không có thì gắn thêm mật khẩu cho tài khoản Google. */
  setPassword(newPassword: string, currentPassword?: string): Promise<void>
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
