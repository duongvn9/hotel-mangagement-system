import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ServicesPage } from './pages/ServicesPage'
export const serviceRoutes: RouteObject[] = [
  {
    path: 'manager/services',
    element: (
      <RequireAuth roles={[Role.Manager]} permissions={['facility:manage']}>
        <ServicesPage />
      </RequireAuth>
    ),
  },
]
