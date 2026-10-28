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

const RECEPTION_DESK: NavItem[] = [
  { to: '/reception/front-desk', label: 'Đến và đi trong ngày' },
  { to: '/reception/rooms', label: 'Sơ đồ phòng' },
  { to: '/reception/bookings', label: 'Danh sách booking' },
  { to: '/reception/booking/new', label: 'Tạo booking' },
  { to: '/reception/guests', label: 'Tìm khách' },
]

const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  CUSTOMER: [
    {
      label: 'Của tôi',
      items: [
        { to: '/customer/service-orders', label: 'Dịch vụ của tôi' },
        { to: '/customer/service-orders/new', label: 'Yêu cầu dịch vụ' },
        { to: '/customer/issues', label: 'Sự cố của tôi' },
        { to: '/customer/issues/report', label: 'Báo sự cố' },
        { to: '/my-feedback', label: 'Phản hồi của tôi' },
      ],
    },
  ],
  RECEPTIONIST: [
    {
      label: 'Quầy lễ tân',
      items: [{ to: RECEPTION_DASHBOARD, label: 'Tổng quan' }, ...RECEPTION_DESK],
    },
    {
      label: 'Yêu cầu',
      items: [
        { to: '/staff/service-orders', label: 'Yêu cầu dịch vụ' },
        { to: '/staff/issues', label: 'Yêu cầu sự cố' },
        { to: '/staff/feedback', label: 'Phản hồi' },
      ],
    },
  ],
  MANAGER: [
    {
      label: 'Giám sát',
      items: [
        { to: '/manager/dashboard', label: 'Tổng quan' },
        { to: '/manager/task-queues', label: 'Hàng đợi task' },
        { to: '/manager/issues', label: 'Danh sách sự cố' },
      ],
    },
    {
      label: 'Báo cáo',
      items: [
        { to: '/manager/reports/revenue', label: 'Báo cáo doanh thu' },
        { to: '/manager/reports/operational', label: 'Báo cáo vận hành' },
      ],
    },
    {
      label: 'Cơ sở vật chất',
      items: [
        { to: '/manager/rooms', label: 'Phòng' },
        { to: '/manager/room-types', label: 'Loại phòng' },
        { to: '/manager/amenities', label: 'Tiện nghi' },
        { to: '/manager/services', label: 'Dịch vụ' },
      ],
    },
    {
      label: 'Quản trị',
      items: [
        { to: '/manager/accounts', label: 'Tài khoản' },
        { to: '/manager/roles', label: 'Vai trò' },
      ],
    },
    {
      label: 'Lễ tân',
      items: [
        { to: RECEPTION_DASHBOARD, label: 'Tổng quan lễ tân' },
        ...RECEPTION_DESK,
        { to: '/staff/feedback', label: 'Phản hồi' },
      ],
    },
  ],
  SERVICE_STAFF: [
    {
      label: 'Công việc',
      items: [
        { to: '/staff/service/dashboard', label: 'Bảng điều khiển dịch vụ' },
        { to: '/staff/service-history', label: 'Lịch sử thực hiện dịch vụ' },
      ],
    },
  ],
  OPERATIONS_STAFF: [
    {
      label: 'Công việc',
      items: [{ to: '/staff/operations/dashboard', label: 'Bảng điều khiển vận hành' }],
    },
    {
      label: 'Bảo trì',
      items: [
        { to: '/operations/maintenance/report', label: 'Báo hỏng thiết bị' },
        { to: '/operations/maintenance/history', label: 'Lịch sử bảo trì' },
      ],
    },
  ],
}

const STAFF_ROLES = ['MANAGER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF']

/** Trang làm việc của từng role, dùng sau khi đăng nhập và cho nút "Khu làm việc". */
const ROLE_HOME: Record<string, string> = {
  MANAGER: '/manager/dashboard',
  RECEPTIONIST: RECEPTION_DASHBOARD,
  SERVICE_STAFF: '/staff/service/dashboard',
  OPERATIONS_STAFF: '/staff/operations/dashboard',
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
  const [first, ...rest] = groups
  // Việc được giao nằm đầu nhóm đầu tiên của role.
  return first
    ? [{ ...first, items: [ASSIGNED_TASKS, ...first.items] }, ...rest]
    : [{ label: 'Công việc', items: [ASSIGNED_TASKS] }]
}

export const flatLinks = (me: Me): NavItem[] => navGroupsFor(me).flatMap((group) => group.items)

const STAFF_AREAS = ['staff', 'manager', 'reception', 'operations']

const firstSegment = (path: string | undefined) => path?.replace(/^\/+/, '').split('/')[0]

/**
 * Tách các route thuộc khu nhân viên (/staff, /manager, /reception, /operations) khỏi phần còn lại
 * để router đặt chúng vào khung nhân viên mà không phải đổi URL hay file route của từng feature.
 */
export function partitionStaffRoutes(routes: RouteObject[]): {
  staff: RouteObject[]
  other: RouteObject[]
} {
  const staff: RouteObject[] = []
  const other: RouteObject[] = []
  for (const route of routes) {
    const area = firstSegment(route.path)
    ;(area !== undefined && STAFF_AREAS.includes(area) ? staff : other).push(route)
  }
  return { staff, other }
}
