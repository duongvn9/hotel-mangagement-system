import type { RouteObject } from 'react-router'
import { Role } from '@/features/auth/api'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { FeedbackPage } from './pages/FeedbackPage'
import { MyFeedbackPage } from './pages/MyFeedbackPage'

export const feedbackRoutes: RouteObject[] = [
  {
    path: 'staff/feedback',
    element: (
      <RequireAuth roles={[Role.Receptionist, Role.Manager]}>
        <FeedbackPage />
      </RequireAuth>
    ),
  },
  {
    path: 'my-feedback',
    element: (
      <RequireAuth roles={[Role.Customer]}>
        <MyFeedbackPage />
      </RequireAuth>
    ),
  },
]
