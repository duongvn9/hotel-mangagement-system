import { createBrowserRouter } from 'react-router'
import { accountRoutes } from '@/features/accounts/routes'
import { authRoutes } from '@/features/auth/routes'
import { feedbackRoutes } from '@/features/feedback/routes'
import { roleRoutes } from '@/features/roles/routes'
import { roomTypeRoutes } from '@/features/room-types/routes'
import { roomRoutes } from '@/features/rooms/routes'
import { amenityRoutes } from '@/features/amenities/routes'
import { taskRoutes } from '@/features/tasks/routes'
import { staffDashboardRoutes } from '@/features/staff-dashboards/routes'

import { PublicLayout } from '@/layouts/PublicLayout'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * Khung routing. Route theo role (Customer, Receptionist, Service Staff,
 * Operations Staff, Manager) thêm trong task "Layout chung, routing theo role".
 * Gợi ý: mỗi feature export mảng route riêng rồi gộp vào đây.
 */
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      ...authRoutes,
      ...accountRoutes,
      ...roleRoutes,
      ...roomTypeRoutes,
      ...roomRoutes,
      ...amenityRoutes,
      ...feedbackRoutes,
      ...taskRoutes,
      // TODO(#18): Move staff dashboards into the H10 role layout when available.
      ...staffDashboardRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
