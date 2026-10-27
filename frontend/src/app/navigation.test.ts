import type { RouteObject } from 'react-router'
import type { Me } from '@/features/auth/api'
import { flatLinks, isStaffRole, navGroupsFor, partitionStaffRoutes, roleHome } from './navigation'

const me = (role: string, permissions: string[] = []): Me => ({
  id: 'u1',
  email: 'u@hms.local',
  fullName: 'Người dùng',
  role,
  permissions,
})

describe('roleHome', () => {
  it('sends each role to its own workspace and everyone else to the home page', () => {
    expect(roleHome('MANAGER')).toBe('/manager/dashboard')
    expect(roleHome('RECEPTIONIST')).toBe('/reception/front-desk')
    expect(roleHome('SERVICE_STAFF')).toBe('/staff/service/dashboard')
    expect(roleHome('OPERATIONS_STAFF')).toBe('/staff/operations/dashboard')
    expect(roleHome('CUSTOMER')).toBe('/')
    expect(roleHome('SOMETHING_NEW')).toBe('/')
  })
})

describe('isStaffRole', () => {
  it('treats the four staff roles as staff', () => {
    for (const role of ['MANAGER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF']) {
      expect(isStaffRole(role)).toBe(true)
    }
    expect(isStaffRole('CUSTOMER')).toBe(false)
  })
})

describe('navGroupsFor', () => {
  it('groups the reception links', () => {
    const groups = navGroupsFor(me('RECEPTIONIST'))
    expect(groups.map((group) => group.label)).toEqual(['Quầy lễ tân', 'Yêu cầu'])
    expect(groups[0]?.items.map((item) => item.to)).toEqual([
      '/reception/front-desk',
      '/reception/rooms',
      '/reception/bookings',
      '/reception/booking/new',
      '/reception/guests',
    ])
  })

  it('groups the manager links and lets the manager reach the reception pages', () => {
    const groups = navGroupsFor(me('MANAGER'))
    expect(groups.map((group) => group.label)).toEqual([
      'Giám sát',
      'Báo cáo',
      'Cơ sở vật chất',
      'Quản trị',
      'Lễ tân',
    ])
    expect(flatLinks(me('MANAGER')).map((link) => link.to)).toEqual(
      expect.arrayContaining(['/manager/dashboard', '/manager/rooms', '/reception/front-desk']),
    )
  })

  it('gives service and operations staff their task pages', () => {
    expect(flatLinks(me('SERVICE_STAFF')).map((link) => link.to)).toEqual([
      '/staff/tasks',
      '/staff/service/dashboard',
      '/staff/service-history',
    ])
    expect(flatLinks(me('OPERATIONS_STAFF')).map((link) => link.to)).toEqual([
      '/staff/tasks',
      '/staff/operations/dashboard',
      '/operations/maintenance/report',
      '/operations/maintenance/history',
    ])
  })

  it('lists the customer pages including feedback', () => {
    expect(flatLinks(me('CUSTOMER')).map((link) => link.to)).toEqual([
      '/customer/service-orders',
      '/customer/service-orders/new',
      '/customer/issues',
      '/customer/issues/report',
      '/my-feedback',
    ])
  })

  it('shows the assigned-tasks link to other roles only with the task permission', () => {
    expect(flatLinks(me('RECEPTIONIST')).map((link) => link.to)).not.toContain('/staff/tasks')
    expect(flatLinks(me('RECEPTIONIST', ['task:execute'])).map((link) => link.to)).toContain(
      '/staff/tasks',
    )
  })

  it('has a unique label for every link of a role', () => {
    for (const role of [
      'MANAGER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
      'CUSTOMER',
    ]) {
      const labels = flatLinks(me(role, ['task:execute'])).map((link) => link.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('returns nothing for an unknown role, except the tasks assigned to it by permission', () => {
    expect(navGroupsFor(me('SOMETHING_NEW'))).toEqual([])
    expect(flatLinks(me('SOMETHING_NEW', ['task:execute'])).map((link) => link.to)).toEqual([
      '/staff/tasks',
    ])
  })
})

describe('partitionStaffRoutes', () => {
  const route = (path: string): RouteObject => ({ path })

  it('moves staff areas to the staff layout whatever the leading slash', () => {
    const routes = [
      route('/manager/dashboard'),
      route('manager/accounts'),
      route('/staff/tasks/:id'),
      route('reception/front-desk'),
      route('operations/maintenance/report'),
      route('search'),
      route('/customer/issues'),
      route('profile'),
      route('login'),
    ]
    const { staff, other } = partitionStaffRoutes(routes)
    expect(staff.map((item) => item.path)).toEqual([
      '/manager/dashboard',
      'manager/accounts',
      '/staff/tasks/:id',
      'reception/front-desk',
      'operations/maintenance/report',
    ])
    expect(other.map((item) => item.path)).toEqual([
      'search',
      '/customer/issues',
      'profile',
      'login',
    ])
  })

  it('does not mistake similar prefixes for staff areas and keeps route objects intact', () => {
    const lookalike = route('staffing/plan')
    const index: RouteObject = { index: true }
    const { staff, other } = partitionStaffRoutes([lookalike, index])
    expect(staff).toEqual([])
    expect(other).toEqual([lookalike, index])
    expect(other[0]).toBe(lookalike)
  })
})
