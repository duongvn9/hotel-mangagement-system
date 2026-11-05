/** Mục menu đang mở: đúng đường dẫn hoặc đường dẫn con (`/staff/rooms/123` thuộc `/staff/rooms`). */
export function isNavActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`)
}
