import axios, { isAxiosError } from 'axios'
import { env } from './env'

/**
 * Axios instance dùng chung cho mọi request tới backend.
 * Interceptor bên dưới gắn Firebase ID token (hoặc header dev) vào mọi request.
 */
export const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
})

let getToken: (() => Promise<string | null>) | null = null

/** Gọi sau khi đăng nhập Firebase để api tự đính kèm token; truyền null khi đăng xuất. */
export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null) {
  getToken = provider
}

let devUser: { id: string; role: string } | null = null

/** Chế độ dev khi chưa có Firebase: gửi header giả lập user (backend chỉ nhận khi không phải production). */
export function setDevUser(user: { id: string; role: string } | null) {
  devUser = user
}

api.interceptors.request.use(async (config) => {
  const token = getToken ? await getToken() : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (devUser) {
    config.headers['x-dev-user-id'] = devUser.id
    config.headers['x-dev-role'] = devUser.role
  }
  return config
})

/** Dạng lỗi chuẩn backend trả về (xem backend/src/common/filters). */
export interface ApiError {
  statusCode: number
  message: string | string[]
  error: string
  path: string
  timestamp: string
}

/** Câu thông báo lỗi để hiển thị: lấy message backend trả về, nếu không có thì dùng câu mặc định. */
export function getErrorMessage(
  error: unknown,
  fallback = 'Có lỗi xảy ra, vui lòng thử lại',
): string {
  const message = isAxiosError<ApiError>(error) ? error.response?.data?.message : undefined
  if (Array.isArray(message)) return message.join(', ')
  return message || fallback
}
