import { matchRoutes } from 'react-router'
import { WorkspaceShell } from '@/layouts/WorkspaceShell'
import { PublicLayout } from '@/layouts/PublicLayout'
import { router } from './router'

function layoutOf(path: string) {
  const matches = matchRoutes(router.routes, path)
  const element = matches?.[0]?.route.element as { type?: unknown } | undefined
  return { matches, layout: element?.type }
}

describe('router layouts', () => {
  afterAll(() => router.dispose())

  it.each([
    '/manager/dashboard',
    '/manager/accounts',
    '/manager/task-queues/abc',
    '/reception/dashboard',
    '/reception/front-desk',
    '/reception/rooms',
    '/reception/bookings/BK1/edit',
    '/operations/maintenance/report',
    '/staff/tasks',
    '/staff/service/dashboard',
    '/staff/feedback',
    '/my-bookings',
    '/my-feedback',
    '/customer/service-orders',
    '/customer/issues/report',
    '/customer/issues/abc',
    '/profile',
  ])('puts %s in the workspace layout', (path) => {
    expect(layoutOf(path).layout).toBe(WorkspaceShell)
  })

  it.each([
    '/',
    '/search',
    '/booking/new',
    '/booking/abc',
    '/booking/lookup',
    '/room-types/abc',
    '/payment/vnpay-return',
    '/experiences',
  ])('puts %s in the guest layout', (path) => {
    expect(layoutOf(path).layout).toBe(PublicLayout)
  })

  it.each(['/login', '/register'])('renders auth page %s without a site layout', (path) => {
    expect(layoutOf(path).layout).toBeUndefined()
  })

  it('keeps the guest layout for unknown pages and does not mistake lookalike prefixes', () => {
    expect(layoutOf('/nope').layout).toBe(PublicLayout)
    expect(layoutOf('/staffing/plan').layout).toBe(PublicLayout)
    expect(layoutOf('/profiles').layout).toBe(PublicLayout)
  })

  it('keeps the real page routes as the leaves, so their URLs and guards are unchanged', () => {
    const leaf = matchRoutes(router.routes, '/manager/dashboard')?.at(-1)?.route
    expect(leaf?.path).toBe('/manager/dashboard')
    const home = matchRoutes(router.routes, '/')?.at(-1)?.route
    expect(home?.index).toBe(true)
    const exp = matchRoutes(router.routes, '/experiences')?.at(-1)?.route
    expect(exp?.path).toBe('experiences')
  })
})
