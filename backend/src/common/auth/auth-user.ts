/** Người dùng đã xác thực, gắn vào `req.user` và lấy ra bằng @CurrentUser(). */
export interface AuthUser {
  /** _id của User trong MongoDB. */
  id: string;
  email: string;
  /** Mã role, ví dụ 'MANAGER' (xem Role enum). */
  role: string;
}

declare global {
  // oxlint-disable-next-line typescript/no-namespace -- cách duy nhất để mở rộng kiểu Request của Express
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
