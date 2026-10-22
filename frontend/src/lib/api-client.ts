import axios from 'axios'
import { env } from './env'

/**
 * Axios instance dùng chung cho mọi request tới backend.
 * Task "Xác thực Firebase" sẽ gắn ID token vào header Authorization tại interceptor bên dưới.
 */
export const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
})

let getToken: (() => Promise<string | null>) | null = null

/** Gọi một lần sau khi khởi tạo Firebase Auth để api tự đính kèm token. */
export function setAuthTokenProvider(provider: () => Promise<string | null>) {
  getToken = provider
}

api.interceptors.request.use(async (config) => {
  const token = getToken ? await getToken() : null
  if (token) config.headers.Authorization = `Bearer ${token}`
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
