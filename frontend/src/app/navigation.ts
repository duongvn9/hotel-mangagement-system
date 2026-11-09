import type { RouteObject } from 'react-router'
import type { Me } from '@/features/auth/api'

/**
 * Nguồn duy nhất cho menu theo role (khung nhân viên, header khách và UserMenu cùng dùng).
 * Thêm trang mới cho một role: thêm một mục vào nhóm phù hợp ở đây; nhãn phải khác nhau trong
 * cùng một role. Việc ai được vào trang vẫn do RequireAuth của route quyết định.
 */
export interface NavItem {
  to: string
  label: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

const RECEPTION_DASHBOARD = '/reception/dashboard'

const NOTIFICATIONS_NAV_ITEM: NavItem = { to: '/notifications', label: 'Thông báo' }
const PROFILE_NAV_ITEM: NavItem = { to: '/profile', label: 'Hồ sơ' }

const ACCOUNT_GROUP: NavGroup = {
  label: 'Tài khoản',
  items: [NOTIFICATIONS_NAV_ITEM, PROFILE_NAV_ITEM],
}

const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  CUSTOMER: [
    {
      label: 'Kỳ nghỉ của tôi',
      items: [
        { to: '/customer/dashboard', label: 'Tổng quan' },
        { to: '/my-bookings', label: 'Đặt phòng của tôi' },
        { to: '/customer/service-orders', label: 'Dịch vụ phòng' },
        { to: '/my-feedback', label: 'Đánh giá' },
        { to: '/customer/issues/report', label: 'Báo sự cố' },
        { to: '/customer/issues', label: 'Danh sách sự cố' },
      ],
    },
    ACCOUNT_GROUP,
  ],
  RECEPTIONIST: [
    {
      label: 'Lễ tân',
      items: [
        { to: RECEPTION_DASHBOARD, label: 'Bảng điều khiển' },
        { to: '/reception/front-desk', label: 'Quầy lễ tân' },
        { to: '/reception/bookings', label: 'Đặt phòng' },
        { to: '/reception/booking/new', label: 'Đặt phòng tại quầy' },
        { to: '/reception/guests', label: 'Tra cứu khách' },
        { to: '/reception/rooms', label: 'Sơ đồ trạng thái phòng' },
      ],
    },
    {
      label: 'Yêu cầu',
      items: [
        { to: '/staff/service-orders', label: 'Yêu cầu dịch vụ' },
        { to: '/staff/issues', label: 'Sự cố' },
        { to: '/staff/feedback', label: 'Đánh giá của khách' },
      ],
    },
    ACCOUNT_GROUP,
  ],
  SERVICE_STAFF: [
    {
      label: 'Dịch vụ',
      items: [
        { to: '/staff/service/dashboard', label: 'Bảng điều khiển' },
        { to: '/staff/tasks', label: 'Công việc được giao' },
        { to: '/staff/service-history', label: 'Lịch sử thực hiện dịch vụ' },
      ],
    },
    ACCOUNT_GROUP,
  ],
  OPERATIONS_STAFF: [
    {
      label: 'Vận hành',
      items: [
        { to: '/staff/operations/dashboard', label: 'Bảng điều khiển' },
        { to: '/staff/tasks', label: 'Công việc được giao' },
        { to: '/operations/maintenance/history', label: 'Lịch sử bảo trì' },
        { to: '/operations/maintenance/report', label: 'Báo hỏng hóc' },
      ],
    },
    ACCOUNT_GROUP,
  ],
  MANAGER: [
    {
      label: 'Tổng quan',
      items: [
        { to: '/manager/dashboard', label: 'Bảng điều khiển' },
        { to: '/reception/bookings', label: 'Đặt phòng' },
        { to: '/reception/rooms', label: 'Sơ đồ trạng thái phòng' },
      ],
    },
    {
      label: 'Khách sạn',
      items: [
        { to: '/manager/rooms', label: 'Phòng' },
        { to: '/manager/room-types', label: 'Loại phòng' },
        { to: '/manager/amenities', label: 'Tiện nghi' },
        { to: '/manager/services', label: 'Dịch vụ' },
      ],
    },
    {
      label: 'Nhân sự & công việc',
      items: [
        { to: '/manager/accounts', label: 'Tài khoản' },
        { to: '/manager/roles', label: 'Vai trò & quyền' },
        { to: '/manager/task-queues', label: 'Giám sát công việc' },
        { to: '/manager/issues', label: 'Sự cố' },
      ],
    },
    {
      label: 'Báo cáo',
      items: [
        { to: '/manager/reports/revenue', label: 'Báo cáo doanh thu' },
        { to: '/manager/reports/operational', label: 'Báo cáo vận hành' },
        { to: '/staff/feedback', label: 'Đánh giá của khách' },
        { to: '/manager/payments/reconciliation', label: 'Đối soát' },
      ],
    },
    ACCOUNT_GROUP,
  ],
}

const STAFF_ROLES = ['MANAGER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF']

/** Trang làm việc của từng role, dùng sau khi đăng nhập và cho nút "Khu làm việc". */
const ROLE_HOME: Record<string, string> = {
  MANAGER: '/manager/dashboard',
  RECEPTIONIST: RECEPTION_DASHBOARD,
  SERVICE_STAFF: '/staff/service/dashboard',
  OPERATIONS_STAFF: '/staff/operations/dashboard',
  CUSTOMER: '/customer/dashboard',
}

export const roleHome = (role: string): string => ROLE_HOME[role] ?? '/'

export const isStaffRole = (role: string): boolean => STAFF_ROLES.includes(role)

const ASSIGNED_TASKS: NavItem = { to: '/staff/tasks', label: 'Công việc được giao' }

/** Nhân viên dịch vụ/vận hành luôn có việc được giao; role khác chỉ khi có quyền task:execute. */
const hasAssignedTasks = (me: Me) =>
  ['SERVICE_STAFF', 'OPERATIONS_STAFF'].includes(me.role) || me.permissions.includes('task:execute')

/** Các nhóm menu của người dùng; role tự tạo chỉ có việc được giao nếu được cấp quyền. */
export function navGroupsFor(me: Me): NavGroup[] {
  const groups = NAV_BY_ROLE[me.role] ?? []
  if (!hasAssignedTasks(me)) return groups
  const alreadyHasTasks = groups.some((group) =>
    group.items.some((item) => item.to === ASSIGNED_TASKS.to),
  )
  if (alreadyHasTasks) return groups
  const [first, ...rest] = groups
  // Việc được giao nằm đầu nhóm đầu tiên của role khi chưa có trong cấu hình.
  return first
    ? [{ ...first, items: [ASSIGNED_TASKS, ...first.items] }, ...rest]
    : [{ label: 'Công việc', items: [ASSIGNED_TASKS] }]
}

export const flatLinks = (me: Me): NavItem[] => navGroupsFor(me).flatMap((group) => group.items)

/**
 * Điểm vào khu làm việc của một người dùng: trang chủ của role, hoặc mục menu đầu tiên với role
 * tự tạo, hoặc trang chủ công khai khi chưa có mục nào.
 */
export function workspaceHome(me: Me): string {
  if (me.role in ROLE_HOME) return roleHome(me.role)
  return flatLinks(me)[0]?.to ?? '/'
}

const WORKSPACE_AREAS = [
  'staff',
  'manager',
  'reception',
  'operations',
  'customer',
  'my-bookings',
  'my-feedback',
  'profile',
  'notifications',
]

const firstSegment = (path: string | undefined) => path?.replace(/^\/+/, '').split('/')[0]

/**
 * Tách các route thuộc khu làm việc (nhân viên và tài khoản khách) khỏi phần trang công cộng
 * để router đặt chúng vào WorkspaceShell mà không phải đổi URL hay file route của từng feature.
 */
export function partitionWorkspaceRoutes(routes: RouteObject[]): {
  workspace: RouteObject[]
  other: RouteObject[]
} {
  const workspace: RouteObject[] = []
  const other: RouteObject[] = []
  for (const route of routes) {
    const area = firstSegment(route.path)
    ;(area !== undefined && WORKSPACE_AREAS.includes(area) ? workspace : other).push(route)
  }
  return { workspace, other }
}
