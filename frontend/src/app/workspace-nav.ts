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
  Flag,
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
  UserCog,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { navGroupsFor, type NavGroup as AppNavGroup } from '@/app/navigation'
import type {
  NavGroup as WorkspaceNavGroup,
  NavItem as WorkspaceNavItem,
} from '@/components/templates'
import type { Me } from '@/features/auth/api'

export type { WorkspaceNavGroup, WorkspaceNavItem }

export const FALLBACK_ICON: LucideIcon = CircleDot

/**
 * Bảng ánh xạ từ URL đường dẫn đến biểu tượng (LucideIcon).
 * Đồng bộ với biểu tượng được dùng trong prototype UI (ui-prototype/src/lib/nav.ts).
 */
const ICONS_BY_PATH: Record<string, LucideIcon> = {
  // Tổng quan & Bảng điều khiển
  '/manager/dashboard': LayoutDashboard,
  '/reception/dashboard': LayoutDashboard,
  '/staff/service/dashboard': LayoutDashboard,
  '/staff/operations/dashboard': LayoutDashboard,

  // Lễ tân
  '/reception/front-desk': DoorOpen,
  '/reception/rooms': LayoutGrid,
  '/reception/bookings': CalendarDays,
  '/reception/booking/new': UserPlus,
  '/reception/guests': Users,

  // Yêu cầu, sự cố & công việc nhân viên
  '/staff/service-orders': ConciergeBell,
  '/staff/issues': AlertTriangle,
  '/manager/issues': AlertTriangle,
  '/staff/feedback': Star,
  '/staff/tasks': ClipboardList,
  '/staff/service-history': History,

  // Vận hành & bảo trì
  '/operations/maintenance/history': History,
  '/operations/maintenance/report': Wrench,

  // Giám sát & Báo cáo quản lý
  '/manager/task-queues': ListChecks,
  '/manager/payments/reconciliation': Receipt,
  '/manager/reports/revenue': TrendingUp,
  '/manager/reports/operational': BarChart3,

  // Cơ sở vật chất
  '/manager/rooms': BedDouble,
  '/manager/room-types': Layers,
  '/manager/amenities': Armchair,
  '/manager/services': UtensilsCrossed,

  // Quản trị hệ thống
  '/manager/accounts': UserCog,
  '/manager/roles': ShieldCheck,

  // Khách hàng
  '/my-bookings': CalendarDays,
  '/customer/service-orders': ConciergeBell,
  '/customer/service-orders/new': CirclePlus,
  '/customer/issues': AlertTriangle,
  '/customer/issues/report': Flag,
  '/my-feedback': MessageSquareHeart,
}

/**
 * Lấy icon tương ứng với đường dẫn to. Nếu chưa có ánh xạ, trả về FALLBACK_ICON.
 */
export function iconForPath(to: string): LucideIcon {
  return ICONS_BY_PATH[to] ?? FALLBACK_ICON
}

/**
 * Chuyển đổi danh sách nhóm menu từ cấu hình app (AppNavGroup[])
 * sang định dạng nhóm menu của template WorkspaceLayout (WorkspaceNavGroup[]),
 * gán `title: label` và thêm `icon: iconForPath(to)` cho từng mục.
 */
export function toWorkspaceGroups(groups: AppNavGroup[]): WorkspaceNavGroup[] {
  return groups.map((group) => ({
    title: group.label,
    items: group.items.map((item) => ({
      to: item.to,
      label: item.label,
      icon: iconForPath(item.to),
    })),
  }))
}

/**
 * Lấy các nhóm menu dành cho khung làm việc (WorkspaceShell) theo thông tin người dùng `me`.
 * - Đối với khách hàng (role === 'CUSTOMER'): chèn thêm mục Booking của tôi (/my-bookings)
 *   vào đầu nhóm đầu tiên.
 * - Đối với nhân viên: chuyển đổi trực tiếp từ `navGroupsFor(me)`.
 */
export function shellGroupsFor(me: Me): WorkspaceNavGroup[] {
  const groups = navGroupsFor(me)
  if (me.role === 'CUSTOMER') {
    const bookingItem = {
      to: '/my-bookings',
      label: 'Booking của tôi',
    }
    const [first, ...rest] = groups
    const customerFirst: AppNavGroup = first
      ? { ...first, items: [bookingItem, ...first.items] }
      : { label: 'Của tôi', items: [bookingItem] }
    return toWorkspaceGroups([customerFirst, ...rest])
  }
  return toWorkspaceGroups(groups)
}
