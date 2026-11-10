import type { RouteObject } from 'react-router'
import type { Me } from '@/features/auth/api'
import {
  flatLinks,
  isStaffRole,
  navGroupsFor,
  partitionWorkspaceRoutes,
  roleHome,
  workspaceHome,
} from './navigation'

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
    expect(roleHome('RECEPTIONIST')).toBe('/reception/dashboard')
    expect(roleHome('SERVICE_STAFF')).toBe('/staff/service/dashboard')
    expect(roleHome('OPERATIONS_STAFF')).toBe('/staff/operations/dashboard')
    expect(roleHome('CUSTOMER')).toBe('/customer/dashboard')
    expect(roleHome('SOMETHING_NEW')).toBe('/')
  })
})

describe('workspaceHome', () => {
  it('uses the role home, or the first menu page for a custom role, or the home page', () => {
    expect(workspaceHome(me('CUSTOMER'))).toBe('/customer/dashboard')
    expect(workspaceHome(me('MANAGER'))).toBe('/manager/dashboard')
    expect(workspaceHome(me('CUSTOM_ROLE', ['task:execute']))).toBe('/staff/tasks')
    expect(workspaceHome(me('CUSTOM_ROLE'))).toBe('/')
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
    expect(groups.map((group) => group.label)).toEqual(['Lễ tân', 'Yêu cầu', 'Tài khoản'])
    expect(groups[0]?.items.map((item) => item.to)).toEqual([
      '/reception/dashboard',
      '/reception/front-desk',
      '/reception/bookings',
      '/reception/booking/new',
      '/reception/guests',
      '/reception/rooms',
    ])
  })

  it('groups the manager links and lets the manager reach the reception pages', () => {
    const groups = navGroupsFor(me('MANAGER'))
    expect(groups.map((group) => group.label)).toEqual([
      'Tổng quan',
      'Khách sạn',
      'Nhân sự & công việc',
      'Báo cáo',
      'Tài khoản',
    ])
    expect(flatLinks(me('MANAGER')).map((link) => link.to)).toEqual(
      expect.arrayContaining([
        '/manager/dashboard',
        '/manager/rooms',
        '/reception/bookings',
        '/reception/rooms',
      ]),
    )
  })

  it('gives service and operations staff their task pages', () => {
    expect(flatLinks(me('SERVICE_STAFF')).map((link) => link.to)).toEqual([
      '/staff/service/dashboard',
      '/staff/tasks',
      '/staff/service-history',
      '/notifications',
      '/profile',
    ])
    expect(flatLinks(me('OPERATIONS_STAFF')).map((link) => link.to)).toEqual([
      '/staff/operations/dashboard',
      '/staff/tasks',
      '/operations/maintenance/history',
      '/operations/maintenance/report',
      '/notifications',
      '/profile',
    ])
  })

  it('lists the customer pages including feedback and profile', () => {
    expect(flatLinks(me('CUSTOMER')).map((link) => link.to)).toEqual([
      '/customer/dashboard',
      '/my-bookings',
      '/customer/service-orders',
      '/my-feedback',
      '/customer/issues/report',
      '/customer/issues',
      '/notifications',
      '/profile',
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

describe('partitionWorkspaceRoutes', () => {
  const route = (path: string): RouteObject => ({ path })

  it('moves workspace areas to the workspace layout whatever the leading slash', () => {
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
      route('my-bookings'),
      route('my-feedback'),
    ]
    const { workspace, other } = partitionWorkspaceRoutes(routes)
    expect(workspace.map((item) => item.path)).toEqual([
      '/manager/dashboard',
      'manager/accounts',
      '/staff/tasks/:id',
      'reception/front-desk',
      'operations/maintenance/report',
      '/customer/issues',
      'profile',
      'my-bookings',
      'my-feedback',
    ])
    expect(other.map((item) => item.path)).toEqual(['search', 'login'])
  })

  it('does not mistake similar prefixes for workspace areas and keeps route objects intact', () => {
    const lookalikes = [
      route('staffing/plan'),
      route('my-bookingsx'),
      route('profiles'),
      route('customers'),
    ]
    const index: RouteObject = { index: true }
    const { workspace, other } = partitionWorkspaceRoutes([...lookalikes, index])
    expect(workspace).toEqual([])
    expect(other).toEqual([...lookalikes, index])
    expect(other[0]).toBe(lookalikes[0])
  })
})
