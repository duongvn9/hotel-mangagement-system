import {
  AlertTriangle,
  Armchair,
  BarChart3,
  BedDouble,
  CalendarDays,
  CircleDot,
  CirclePlus,
  ClipboardList,
  ConciergeBell,
  DoorOpen,
  History,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MessageSquareHeart,
  Receipt,
  ShieldCheck,
  Star,
  TrendingUp,
  User,
  UserCog,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { navGroupsFor } from '@/app/navigation'
import type { Me } from '@/features/auth/api'
import { FALLBACK_ICON, iconForPath, shellGroupsFor, toWorkspaceGroups } from './workspace-nav'

const me = (role: string, permissions: string[] = []): Me => ({
  id: 'u-test',
  email: 'test@hms.local',
  fullName: 'Người dùng kiểm thử',
  role,
  permissions,
})

describe('workspace-nav', () => {
  describe('(a) bảng ánh xạ icon chính xác cho các đường dẫn', () => {
    it('ánh xạ đúng icon cho từng trang quản lý và nhân viên', () => {
      expect(iconForPath('/manager/dashboard')).toBe(LayoutDashboard)
      expect(iconForPath('/reception/dashboard')).toBe(LayoutDashboard)
      expect(iconForPath('/staff/service/dashboard')).toBe(LayoutDashboard)
      expect(iconForPath('/staff/operations/dashboard')).toBe(LayoutDashboard)
      expect(iconForPath('/reception/front-desk')).toBe(DoorOpen)
      expect(iconForPath('/reception/rooms')).toBe(LayoutGrid)
      expect(iconForPath('/reception/bookings')).toBe(CalendarDays)
      expect(iconForPath('/reception/booking/new')).toBe(UserPlus)
      expect(iconForPath('/reception/guests')).toBe(Users)
      expect(iconForPath('/staff/service-orders')).toBe(ConciergeBell)
      expect(iconForPath('/staff/issues')).toBe(AlertTriangle)
      expect(iconForPath('/manager/issues')).toBe(AlertTriangle)
      expect(iconForPath('/staff/feedback')).toBe(Star)
      expect(iconForPath('/staff/tasks')).toBe(ClipboardList)
      expect(iconForPath('/staff/service-history')).toBe(History)
      expect(iconForPath('/operations/maintenance/history')).toBe(History)
      expect(iconForPath('/operations/maintenance/report')).toBe(Wrench)
      expect(iconForPath('/manager/task-queues')).toBe(ListChecks)
      expect(iconForPath('/manager/payments/reconciliation')).toBe(Receipt)
      expect(iconForPath('/manager/reports/revenue')).toBe(TrendingUp)
      expect(iconForPath('/manager/reports/operational')).toBe(BarChart3)
      expect(iconForPath('/manager/rooms')).toBe(BedDouble)
      expect(iconForPath('/manager/room-types')).toBe(Layers)
      expect(iconForPath('/manager/amenities')).toBe(Armchair)
      expect(iconForPath('/manager/services')).toBe(UtensilsCrossed)
      expect(iconForPath('/manager/accounts')).toBe(UserCog)
      expect(iconForPath('/manager/roles')).toBe(ShieldCheck)
    })

    it('ánh xạ đúng icon cho các trang của khách hàng và hồ sơ', () => {
      expect(iconForPath('/customer/dashboard')).toBe(LayoutDashboard)
      expect(iconForPath('/my-bookings')).toBe(CalendarDays)
      expect(iconForPath('/customer/service-orders')).toBe(ConciergeBell)
      expect(iconForPath('/customer/service-orders/new')).toBe(CirclePlus)
      expect(iconForPath('/customer/issues')).toBe(AlertTriangle)
      expect(iconForPath('/customer/issues/report')).toBe(AlertTriangle)
      expect(iconForPath('/my-feedback')).toBe(MessageSquareHeart)
      expect(iconForPath('/profile')).toBe(User)
    })
  })

  describe('(b) icon mặc định khi không tìm thấy', () => {
    it('dùng FALLBACK_ICON (CircleDot) cho đường dẫn lạ', () => {
      expect(FALLBACK_ICON).toBe(CircleDot)
      expect(iconForPath('/something/new')).toBe(FALLBACK_ICON)
      expect(iconForPath('/unknown/path')).toBe(FALLBACK_ICON)
    })
  })

  describe('(c) bảo vệ: không đường dẫn nào trong menu bị thiếu icon', () => {
    const roles = ['MANAGER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF', 'CUSTOMER']

    it.each(roles)('mọi mục menu của role %s đều có icon cụ thể (khác FALLBACK_ICON)', (role) => {
      const groups = shellGroupsFor(me(role))
      const flat = groups.flatMap((g) => g.items)
      expect(flat.length).toBeGreaterThan(0)
      for (const item of flat) {
        expect(iconForPath(item.to)).not.toBe(FALLBACK_ICON)
        expect(item.icon).not.toBe(FALLBACK_ICON)
        expect(item.icon).toBe(iconForPath(item.to))
      }
    })

    it('nhân viên được cấp quyền task:execute có icon hợp lệ cho mục công việc', () => {
      for (const role of roles) {
        const groups = shellGroupsFor(me(role, ['task:execute']))
        const flat = groups.flatMap((g) => g.items)
        for (const item of flat) {
          expect(item.icon).not.toBe(FALLBACK_ICON)
        }
      }
    })
  })

  describe('(c2) shellGroupsFor', () => {
    it('chuyển đổi chính xác cấu trúc nhóm cho CUSTOMER', () => {
      const groups = shellGroupsFor(me('CUSTOMER'))
      expect(groups[0].items[0]).toMatchObject({
        to: '/customer/dashboard',
        label: 'Tổng quan',
        icon: LayoutDashboard,
      })
      const paths = groups.flatMap((g) => g.items.map((i) => i.to))
      expect(paths).toEqual([
        '/customer/dashboard',
        '/my-bookings',
        '/customer/service-orders',
        '/my-feedback',
        '/customer/issues/report',
        '/notifications',
        '/profile',
      ])
    })

    it('khớp chính xác với toWorkspaceGroups(navGroupsFor(me)) cho mọi role', () => {
      for (const role of [
        'MANAGER',
        'RECEPTIONIST',
        'SERVICE_STAFF',
        'OPERATIONS_STAFF',
        'CUSTOMER',
      ]) {
        const user = me(role)
        expect(shellGroupsFor(user)).toEqual(toWorkspaceGroups(navGroupsFor(user)))
      }
    })
  })

  describe('(d) toWorkspaceGroups cấu trúc nhóm', () => {
    it('giữ số nhóm, thứ tự, title === label, mỗi mục có to, label, icon', () => {
      const managerNav = navGroupsFor(me('MANAGER'))
      const workspaceNav = toWorkspaceGroups(managerNav)
      expect(workspaceNav).toHaveLength(managerNav.length)
      managerNav.forEach((group, index) => {
        const wsGroup = workspaceNav[index]!
        expect(wsGroup.title).toBe(group.label)
        expect(wsGroup.items).toHaveLength(group.items.length)
        group.items.forEach((item, itemIdx) => {
          const wsItem = wsGroup.items[itemIdx]!
          expect(wsItem.to).toBe(item.to)
          expect(wsItem.label).toBe(item.label)
          expect(wsItem.icon).toBe(iconForPath(item.to))
        })
      })
    })
  })

  describe('(e) toWorkspaceGroups với mảng rỗng', () => {
    it('trả về mảng rỗng', () => {
      expect(toWorkspaceGroups([])).toEqual([])
    })
  })
})
