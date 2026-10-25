/** Existing Manager-accessible screens only; staff/feedback explicitly also permits Manager. */
export const MANAGER_SHORTCUTS = [
  {
    title: 'Tài khoản và vai trò',
    links: [
      { to: '/manager/accounts', label: 'Tài khoản' },
      { to: '/manager/roles', label: 'Vai trò' },
    ],
  },
  {
    title: 'Cơ sở vật chất',
    links: [
      { to: '/manager/rooms', label: 'Phòng' },
      { to: '/manager/room-types', label: 'Loại phòng' },
      { to: '/manager/amenities', label: 'Tiện nghi' },
      { to: '/manager/services', label: 'Dịch vụ' },
    ],
  },
  {
    title: 'Giám sát',
    links: [
      { to: '/manager/task-queues', label: 'Hàng đợi task' },
      { to: '/staff/feedback', label: 'Phản hồi' },
      { to: '/manager/issues', label: 'Danh sách sự cố' },
    ],
  },
  { title: 'Báo cáo', links: [{ to: '/manager/reports/revenue', label: 'Báo cáo doanh thu' }] },
] as const
