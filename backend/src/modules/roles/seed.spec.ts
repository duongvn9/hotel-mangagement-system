import { Role } from '../../common/constants/role.enum.js';
import { PERMISSIONS, SYSTEM_ROLES } from './seed.js';

describe('dữ liệu seed role', () => {
  it('có đủ 5 role hệ thống', () => {
    expect(SYSTEM_ROLES.map((r) => r.code).sort()).toEqual(
      Object.values(Role).sort(),
    );
  });

  it('role chỉ dùng permission đã khai báo', () => {
    for (const role of SYSTEM_ROLES) {
      for (const code of role.permissions) {
        expect(PERMISSIONS, `${role.code} -> ${code}`).toHaveProperty([code]);
      }
    }
  });
});
