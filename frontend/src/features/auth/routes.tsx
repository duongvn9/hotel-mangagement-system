import type { RouteObject } from 'react-router'
import { RequireAuth } from './RequireAuth'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'

export const authOnlyRoutes: RouteObject[] = [
  { path: 'login', element: <LoginPage /> },
  { path: 'register', element: <RegisterPage /> },
  { path: 'forgot-password', element: <ForgotPasswordPage /> },
]

export const authRoutes: RouteObject[] = [
  {
    path: 'profile',
    element: (
      <RequireAuth>
        <ProfilePage />
      </RequireAuth>
    ),
  },
]
