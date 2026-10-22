import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RolesPage } from './pages/RolesPage'

export const roleRoutes: RouteObject[] = [
  {
    path: 'manager/roles',
    element: (
      <RequireAuth roles={[Role.Manager]}>
        <RolesPage />
      </RequireAuth>
    ),
  },
]
