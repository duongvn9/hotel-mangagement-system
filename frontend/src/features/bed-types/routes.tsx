import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { BedTypesPage } from './pages/BedTypesPage'
export const bedTypeRoutes: RouteObject[] = [
  {
    path: 'manager/bed-types',
    element: (
      <RequireAuth roles={[Role.Manager]} permissions={['facility:manage']}>
        <BedTypesPage />
      </RequireAuth>
    ),
  },
]
