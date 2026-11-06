import type { RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { NotificationsPage } from './pages/NotificationsPage'

/** Thông báo (mẫu): mọi người dùng đã đăng nhập, nằm trong khung làm việc. */
export const notificationRoutes: RouteObject[] = [
  {
    path: 'notifications',
    element: (
      <RequireAuth>
        <NotificationsPage />
      </RequireAuth>
    ),
  },
]
