/** Mục menu đang mở: đúng đường dẫn hoặc đường dẫn con (`/staff/rooms/123` thuộc `/staff/rooms`). */
export function isNavActive(pathname: string, to: string, destinations: string[] = []): boolean {
  const matches = (path: string) => pathname === path || pathname.startsWith(`${path}/`)
  return matches(to) && !destinations.some((path) => path.length > to.length && matches(path))
}
