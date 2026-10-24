import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AmenitiesPage } from './pages/AmenitiesPage'
export const amenityRoutes: RouteObject[] = [
  {
    path: 'manager/amenities',
    element: (
      <RequireAuth roles={[Role.Manager]} permissions={['facility:manage']}>
        <AmenitiesPage />
      </RequireAuth>
    ),
  },
]
