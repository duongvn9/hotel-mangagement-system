import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Đánh dấu endpoint không cần đăng nhập (Guest), ví dụ tìm phòng, xem chi tiết phòng. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
