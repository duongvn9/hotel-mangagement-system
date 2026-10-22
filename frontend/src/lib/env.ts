// Biến môi trường phía client phải bắt đầu bằng VITE_ và sẽ bị nhúng vào bundle.
// Tuyệt đối không đặt secret ở đây.
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  appName: import.meta.env.VITE_APP_NAME || 'Grand Emily HMS',
} as const
