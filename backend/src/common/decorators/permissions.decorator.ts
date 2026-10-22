import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Cho role có đủ các permission này dùng endpoint (UC45), kể cả role do Manager tự tạo (UC46).
 * Dùng cùng @Roles(): user qua được nếu role nằm trong @Roles() HOẶC role có đủ permission.
 * Ví dụ: @Roles(Role.ServiceStaff) @Permissions('task:execute').
 */
export const Permissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);
