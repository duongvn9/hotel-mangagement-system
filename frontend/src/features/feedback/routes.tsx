import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { FeedbackPage } from './pages/FeedbackPage'

export const feedbackRoutes: RouteObject[] = [
  {
    path: 'staff/feedback',
    element: (
      <RequireAuth roles={[Role.Receptionist, Role.Manager]}>
        <FeedbackPage />
      </RequireAuth>
    ),
  },
]
