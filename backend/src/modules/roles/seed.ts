import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Role as RoleCode } from '../../common/constants/role.enum.js';
import type { Seed } from '../../database/seed.js';
import { Permission } from './schemas/permission.schema.js';
import { Role } from './schemas/role.schema.js';

/** Quyền ban đầu theo nhóm use case. Manager chỉnh lại được ở UC45. */
export const PERMISSIONS: Record<string, string> = {
  'account:manage': 'Quản lý tài khoản (UC42, UC43)',
  'role:manage': 'Quản lý role và phân quyền (UC44-46)',
  'facility:manage': 'Quản lý phòng, loại phòng, tiện nghi, dịch vụ (UC47-54)',
  'booking:own': 'Đặt và quản lý booking của mình (UC07, UC09, UC12)',
  'booking:manage': 'Quản lý booking tại quầy (UC08, UC10, UC11)',
  'front-desk:operate': 'Check-in, check-out, phụ phí (UC13-18)',
  'invoice:pay': 'Xem và thanh toán hóa đơn (UC19-21)',
  'service-order:create': 'Đặt dịch vụ (UC22, UC23)',
  'service-order:review': 'Duyệt và giao việc đặt dịch vụ (UC24-27)',
  'issue:report': 'Báo sự cố (UC28, UC34, UC35)',
  'issue:manage': 'Xử lý sự cố (UC29-33)',
  'task:execute': 'Xem và cập nhật công việc được giao (UC37, UC38)',
  'feedback:submit': 'Gửi phản hồi (UC39)',
  'feedback:reply': 'Xem và trả lời phản hồi (UC40, UC41)',
  'report:view': 'Giám sát và báo cáo (UC55-57)',
};

export const SYSTEM_ROLES: {
  code: RoleCode;
  name: string;
  permissions: string[];
}[] = [
  {
    code: RoleCode.Customer,
    name: 'Khách hàng',
    permissions: [
      'booking:own',
      'invoice:pay',
      'service-order:create',
      'issue:report',
      'feedback:submit',
    ],
  },
  {
    code: RoleCode.Receptionist,
    name: 'Lễ tân',
    permissions: [
      'booking:manage',
      'front-desk:operate',
      'invoice:pay',
      'service-order:review',
      'issue:manage',
      'feedback:reply',
    ],
  },
  {
    code: RoleCode.ServiceStaff,
    name: 'Nhân viên dịch vụ',
    permissions: ['task:execute', 'issue:report'],
  },
  {
    code: RoleCode.OperationsStaff,
    name: 'Nhân viên vận hành',
    permissions: ['task:execute', 'issue:report'],
  },
  {
    code: RoleCode.Manager,
    name: 'Quản lý',
    permissions: [
      'account:manage',
      'role:manage',
      'facility:manage',
      'service-order:review',
      'issue:manage',
      'report:view',
    ],
  },
];

/** Chỉ thêm bản ghi còn thiếu ($setOnInsert), không ghi đè quyền Manager đã chỉnh. */
export const seedRoles: Seed = async (app) => {
  const permissions = app.get<Model<Permission>>(
    getModelToken(Permission.name),
  );
  const roles = app.get<Model<Role>>(getModelToken(Role.name));

  await permissions.bulkWrite(
    Object.entries(PERMISSIONS).map(([code, description]) => ({
      updateOne: {
        filter: { code },
        update: { $setOnInsert: { code, description } },
        upsert: true,
      },
    })),
  );
  await roles.bulkWrite(
    SYSTEM_ROLES.map((role) => ({
      updateOne: {
        filter: { code: role.code },
        update: { $setOnInsert: { ...role, isSystem: true } },
        upsert: true,
      },
    })),
  );
};
