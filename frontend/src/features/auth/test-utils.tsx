import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import type { Me } from './api'
import { AuthContext, type AuthContextValue } from './auth-context'

export const ME: Me = {
  id: 'u1',
  email: 'manager@hms.local',
  fullName: 'Hoàng Thị Quản Lý',
  role: 'MANAGER',
  permissions: [],
}

/** Render routes với AuthContext giả, bắt đầu ở `path`. */
export function renderWithAuth(
  routes: RouteObject[],
  { path = '/', auth = {} }: { path?: string; auth?: Partial<AuthContextValue> } = {},
) {
  const value: AuthContextValue = {
    me: null,
    status: 'anonymous',
    isDevMode: false,
    login: vi.fn(),
    loginAsDev: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    ...auth,
  }
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext value={value}>{children}</AuthContext>
    </QueryClientProvider>
  )
  return { ...render(wrap(<RouterProvider router={router} />)), router, auth: value }
}
