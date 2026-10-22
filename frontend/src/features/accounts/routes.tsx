import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AccountsPage } from './pages/AccountsPage'

export const accountRoutes: RouteObject[] = [
  {
    path: 'manager/accounts',
    element: (
      <RequireAuth roles={[Role.Manager]}>
        <AccountsPage />
      </RequireAuth>
    ),
  },
]
