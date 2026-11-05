import {
  LayoutDashboard, CalendarDays, User, ConciergeBell, MessageSquareHeart, AlertTriangle, DoorOpen, UserPlus, Users, LayoutGrid,
  Receipt, ClipboardList, Wrench, History, Cpu, BedDouble, Layers, Armchair, UtensilsCrossed, UserCog, ShieldCheck, ListChecks,
  TrendingUp, BarChart3, Star, Bell, type LucideIcon,
} from "lucide-react";
import type { Role } from "./mock";

export interface NavItem { to: string; label: string; icon: LucideIcon; proposed?: boolean }
export interface NavGroup { title: string; items: NavItem[] }

export const roleMeta: Record<Role, { label: string; person: string; home: string; blurb: string }> = {
  GUEST: { label: "Khách", person: "Khách vãng lai", home: "/", blurb: "Xem và đặt phòng không cần tài khoản" },
  CUSTOMER: { label: "Khách hàng", person: "Nguyễn Minh Anh", home: "/app/home", blurb: "Đặt phòng, dịch vụ & đánh giá" },
  RECEPTIONIST: { label: "Lễ tân", person: "Trịnh Hải Yến", home: "/app/reception", blurb: "Quầy lễ tân, đặt phòng, thanh toán" },
  SERVICE_STAFF: { label: "Nhân viên dịch vụ", person: "Mai Phương", home: "/app/service-desk", blurb: "Yêu cầu dịch vụ & buồng phòng" },
  OPERATIONS_STAFF: { label: "Nhân viên vận hành", person: "Bùi Tiến", home: "/app/operations", blurb: "Sự cố, bảo trì, thiết bị" },
  MANAGER: { label: "Quản lý", person: "Đỗ Thanh Tâm", home: "/app/dashboard", blurb: "Quản trị toàn bộ khách sạn" },
};

export const navByRole: Record<Exclude<Role, "GUEST">, NavGroup[]> = {
  CUSTOMER: [
    { title: "Kỳ nghỉ của tôi", items: [
      { to: "/app/home", label: "Tổng quan", icon: LayoutDashboard },
      { to: "/app/my-bookings", label: "Đặt phòng của tôi", icon: CalendarDays },
      { to: "/app/order-service", label: "Dịch vụ phòng", icon: ConciergeBell },
      { to: "/app/feedback", label: "Đánh giá", icon: MessageSquareHeart },
      { to: "/app/report-issue", label: "Báo sự cố", icon: AlertTriangle },
    ] },
    { title: "Tài khoản", items: [{ to: "/app/notifications", label: "Thông báo", icon: Bell, proposed: true }, { to: "/app/profile", label: "Hồ sơ", icon: User }] },
  ],
  RECEPTIONIST: [
    { title: "Lễ tân", items: [
      { to: "/app/reception", label: "Bảng điều khiển", icon: LayoutDashboard },
      { to: "/app/front-desk", label: "Quầy lễ tân", icon: DoorOpen },
      { to: "/app/bookings", label: "Đặt phòng", icon: CalendarDays },
      { to: "/app/walk-in", label: "Đặt phòng tại quầy", icon: UserPlus },
      { to: "/app/guests", label: "Tra cứu khách", icon: Users },
      { to: "/app/room-board", label: "Sơ đồ trạng thái phòng", icon: LayoutGrid },
      { to: "/app/reconciliation", label: "Đối soát", icon: Receipt },
    ] },
    { title: "Tài khoản", items: [{ to: "/app/notifications", label: "Thông báo", icon: Bell, proposed: true }, { to: "/app/profile", label: "Hồ sơ", icon: User }] },
  ],
  SERVICE_STAFF: [
    { title: "Dịch vụ", items: [
      { to: "/app/service-desk", label: "Bảng điều khiển", icon: LayoutDashboard },
      { to: "/app/service-orders", label: "Yêu cầu dịch vụ", icon: ConciergeBell },
      { to: "/app/tasks", label: "Công việc được giao", icon: ClipboardList },
      { to: "/app/report-issue", label: "Báo hỏng hóc", icon: AlertTriangle },
    ] },
    { title: "Tài khoản", items: [{ to: "/app/notifications", label: "Thông báo", icon: Bell, proposed: true }, { to: "/app/profile", label: "Hồ sơ", icon: User }] },
  ],
  OPERATIONS_STAFF: [
    { title: "Vận hành", items: [
      { to: "/app/operations", label: "Bảng điều khiển", icon: LayoutDashboard },
      { to: "/app/tasks", label: "Công việc được giao", icon: ClipboardList },
      { to: "/app/issues", label: "Sự cố", icon: AlertTriangle },
      { to: "/app/maintenance", label: "Lịch sử bảo trì", icon: History },
      { to: "/app/equipment", label: "Thiết bị", icon: Cpu },
      { to: "/app/report-issue", label: "Báo hỏng hóc", icon: Wrench },
    ] },
    { title: "Tài khoản", items: [{ to: "/app/notifications", label: "Thông báo", icon: Bell, proposed: true }, { to: "/app/profile", label: "Hồ sơ", icon: User }] },
  ],
  MANAGER: [
    { title: "Tổng quan", items: [
      { to: "/app/dashboard", label: "Bảng điều khiển", icon: LayoutDashboard },
      { to: "/app/bookings", label: "Đặt phòng", icon: CalendarDays },
      { to: "/app/room-board", label: "Sơ đồ trạng thái phòng", icon: LayoutGrid },
    ] },
    { title: "Khách sạn", items: [
      { to: "/app/rooms", label: "Phòng", icon: BedDouble },
      { to: "/app/room-types", label: "Loại phòng", icon: Layers },
      { to: "/app/amenities", label: "Tiện nghi", icon: Armchair },
      { to: "/app/services", label: "Dịch vụ", icon: UtensilsCrossed },
      { to: "/app/equipment", label: "Thiết bị", icon: Cpu },
    ] },
    { title: "Nhân sự & công việc", items: [
      { to: "/app/accounts", label: "Tài khoản", icon: UserCog },
      { to: "/app/roles", label: "Vai trò & quyền", icon: ShieldCheck },
      { to: "/app/task-queues", label: "Giám sát công việc", icon: ListChecks },
      { to: "/app/issues", label: "Sự cố", icon: AlertTriangle },
    ] },
    { title: "Báo cáo", items: [
      { to: "/app/revenue", label: "Báo cáo doanh thu", icon: TrendingUp },
      { to: "/app/operations-report", label: "Báo cáo vận hành", icon: BarChart3 },
      { to: "/app/feedback-review", label: "Đánh giá của khách", icon: Star },
      { to: "/app/reconciliation", label: "Đối soát", icon: Receipt },
      { to: "/app/notifications", label: "Thông báo", icon: Bell, proposed: true },
    ] },
  ],
};

/** Group whose items contain the current path — the one section shown expanded by default. */
export function activeGroupTitle(role: Exclude<Role, "GUEST">, path: string) {
  const p = path.replace(/\/$/, "");
  const is = (to: string) => p === to || p.startsWith(`${to}/`);
  return navByRole[role].find((g) => g.items.some((i) => is(i.to)))?.title;
}

/** Extra paths a role may open that aren't top-level menu items. */
const extra: Partial<Record<Role, string[]>> = {
  CUSTOMER: ["/app/bookings/"],
  RECEPTIONIST: ["/app/bookings/"],
  MANAGER: ["/app/bookings/", "/app/maintenance", "/app/tasks"],
};

export function canAccess(role: Role, path: string) {
  if (role === "GUEST") return false;
  const p = path.replace(/\/$/, "");
  if (p === "/app/profile" || p === "/app/notifications") return true;
  const allowed = navByRole[role].flatMap((g) => g.items.map((i) => i.to)).concat(extra[role] ?? []);
  return allowed.some((a) => (a.endsWith("/") ? p.startsWith(a) : p === a || p.startsWith(a + "/")));
}
