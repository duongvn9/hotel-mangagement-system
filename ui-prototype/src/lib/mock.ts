import heroImg from "@/assets/hero.jpg";
import deluxeImg from "@/assets/room-deluxe.jpg";
import suiteImg from "@/assets/room-suite.jpg";
import standardImg from "@/assets/room-standard.jpg";
import familyImg from "@/assets/room-family.jpg";
import lobbyImg from "@/assets/lobby.jpg";

export const images = { hero: heroImg, deluxe: deluxeImg, suite: suiteImg, standard: standardImg, family: familyImg, lobby: lobbyImg };

export type Role = "GUEST" | "CUSTOMER" | "RECEPTIONIST" | "SERVICE_STAFF" | "OPERATIONS_STAFF" | "MANAGER";
export type BookingStatus = "ROOM_HELD" | "PENDING_DEPOSIT" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "EXPIRED";
export type RoomStatus = "AVAILABLE" | "OCCUPIED" | "CLEANING" | "MAINTENANCE";

export interface RoomType { id: string; name: string; price: number; capacity: number; size: number; bed: string; image: string; description: string; amenities: string[] }
export interface Room { id: string; number: string; floor: number; typeId: string; status: RoomStatus }
export interface Guest { id: string; name: string; email: string; phone: string; idNumber: string; nationality: string }
export interface Booking { id: string; guestId: string; roomId: string; checkIn: string; checkOut: string; guests: number; status: BookingStatus; source: "ONLINE" | "WALK_IN"; total: number; deposit: number; paid: number; createdAt: string; notes?: string }
export interface Payment { id: string; bookingId: string; amount: number; method: "VNPAY" | "CASH" | "CARD"; status: "SUCCESS" | "PENDING" | "FAILED"; reconciled: boolean; date: string }
export interface Service { id: string; name: string; category: string; price: number; active: boolean }
export interface ServiceOrder { id: string; bookingId: string; serviceId: string; qty: number; status: "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED"; createdAt: string; note?: string; assignee?: string }
export interface Task { id: string; title: string; type: "CLEANING" | "SERVICE" | "MAINTENANCE"; roomId: string; role: "SERVICE_STAFF" | "OPERATIONS_STAFF"; assignee: string; status: "OPEN" | "IN_PROGRESS" | "DONE"; priority: "LOW" | "MEDIUM" | "HIGH"; due: string }
export interface Issue { id: string; title: string; roomId: string; reportedBy: string; severity: "LOW" | "MEDIUM" | "HIGH"; status: "REPORTED" | "IN_PROGRESS" | "RESOLVED"; createdAt: string; description: string; equipmentId?: string; assignee?: string }
export interface Equipment { id: string; name: string; roomId: string; condition: "GOOD" | "NEEDS_REPAIR" | "BROKEN"; lastService: string }
export interface Maintenance { id: string; equipmentId: string; issueId?: string; date: string; technician: string; action: string; cost: number }
export interface Feedback { id: string; bookingId: string; guestId: string; rating: number; comment: string; date: string; reply?: string }
export interface Amenity { id: string; name: string; category: string }
export interface Account { id: string; name: string; email: string; role: Exclude<Role, "GUEST">; active: boolean }
export interface Notification { id: string; title: string; body: string; date: string; read: boolean; roles: Role[] }

const DAY = 86400000;
const base = new Date();
base.setHours(0, 0, 0, 0);
export const day = (offset: number) => new Date(base.getTime() + offset * DAY).toISOString().slice(0, 10);
export const nights = (a: string, b: string) => Math.max(1, Math.round((+new Date(b) - +new Date(a)) / DAY));

export const roomTypes: RoomType[] = [
  { id: "standard", name: "Phòng Đôi Hướng Vườn", price: 1250000, capacity: 2, size: 28, bed: "2 giường đơn", image: standardImg, description: "Phòng hai giường yên tĩnh, ngập ánh sáng nhìn ra khu vườn — lý tưởng cho bạn bè hoặc đồng nghiệp.", amenities: ["Wi‑Fi", "Điều hoà", "Sen mưa", "Bàn làm việc"] },
  { id: "deluxe", name: "Deluxe Giường King", price: 1850000, capacity: 2, size: 36, bed: "1 giường King", image: deluxeImg, description: "Ốp gỗ sồi, chất liệu lanh và vách kính kịch trần đón trọn vịnh lúc bình minh.", amenities: ["Wi‑Fi", "Hướng biển", "Minibar", "Bồn tắm", "TV thông minh"] },
  { id: "family", name: "Phòng Gia Đình Hướng Vườn", price: 2400000, capacity: 4, size: 44, bed: "1 giường King + ghế dài", image: familyImg, description: "Không gian rộng rãi cho gia đình với ghế dài đọc sách và chỗ ngồi bên cửa sổ nhìn ra vườn.", amenities: ["Wi‑Fi", "Hướng vườn", "Minibar", "Tiện nghi cho trẻ em", "Bồn tắm"] },
  { id: "suite", name: "Suite Hướng Biển", price: 4200000, capacity: 3, size: 68, bed: "1 giường King", image: suiteImg, description: "Phòng khách riêng, ban công riêng và chi tiết đồng thau — hạng phòng được yêu thích nhất.", amenities: ["Wi‑Fi", "Ban công hướng biển", "Phòng khách", "Quản gia riêng", "Bồn tắm", "Máy pha espresso"] },
];

const statuses: RoomStatus[] = ["AVAILABLE", "AVAILABLE", "OCCUPIED", "AVAILABLE", "CLEANING", "OCCUPIED", "AVAILABLE", "MAINTENANCE"];
export const rooms: Room[] = Array.from({ length: 24 }, (_, i) => {
  const floor = Math.floor(i / 6) + 1;
  const typeId = floor === 4 ? "suite" : ["standard", "deluxe", "deluxe", "family", "standard", "deluxe"][i % 6];
  return { id: `r${i + 1}`, number: `${floor}0${(i % 6) + 1}`, floor, typeId, status: statuses[i % statuses.length] };
});

const names = ["Nguyễn Minh Anh", "Trần Quốc Bảo", "Lê Thu Hà", "Emma Laurent", "Phạm Đức Huy", "Daniel Kim", "Võ Ngọc Lan", "Sophie Müller", "Hoàng Gia Khang", "Olivia Chen", "Đặng Thảo Vy", "Lucas Martins"];
export const guests: Guest[] = names.map((n, i) => ({
  id: `g${i + 1}`, name: n,
  email: n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").split(" ").slice(-2).join(".") + "@mail.com",
  phone: `+84 90${(1234567 + i * 7919).toString().slice(0, 7)}`,
  idNumber: `0790${(10000000 + i * 3571).toString()}`,
  nationality: /[ăâđêôơư]|Nguyễn|Trần|Lê|Phạm|Võ|Hoàng|Đặng/.test(n) ? "Vietnam" : ["France", "Korea", "Germany", "Taiwan", "Brazil"][i % 5],
}));

const bStatus: BookingStatus[] = ["CHECKED_IN", "CONFIRMED", "CONFIRMED", "PENDING_DEPOSIT", "CHECKED_OUT", "CHECKED_IN", "CANCELLED", "CONFIRMED", "CHECKED_OUT", "EXPIRED", "CONFIRMED", "CHECKED_IN"];
export const bookings: Booking[] = Array.from({ length: 24 }, (_, i) => {
  const s = bStatus[i % bStatus.length];
  const start = s === "CHECKED_IN" ? -1 - (i % 2) : s === "CHECKED_OUT" ? -6 - i : s === "CONFIRMED" ? (i % 2 === 0 ? 0 : 1 + (i % 9)) : 2 + (i % 5);
  const len = 1 + (i % 4);
  const room = rooms[(i * 5) % rooms.length];
  const type = roomTypes.find((t) => t.id === room.typeId)!;
  const total = type.price * len;
  const deposit = Math.round(total * 0.3);
  const paid = s === "CHECKED_OUT" ? total : s === "PENDING_DEPOSIT" || s === "EXPIRED" ? 0 : s === "CANCELLED" ? deposit : deposit;
  return {
    id: `BK${String(2401 + i)}`, guestId: guests[i % guests.length].id, roomId: room.id,
    checkIn: day(start), checkOut: day(start + len), guests: Math.min(type.capacity, 1 + (i % 3)), status: s,
    source: i % 4 === 1 ? "WALK_IN" : "ONLINE", total, deposit, paid, createdAt: day(start - 7 - (i % 10)),
    notes: i % 5 === 0 ? "Đến muộn khoảng 22:00" : undefined,
  };
});

export const payments: Payment[] = bookings.filter((b) => b.paid > 0).flatMap((b, i) => {
  const list: Payment[] = [{ id: `PM${1001 + i * 2}`, bookingId: b.id, amount: b.deposit, method: b.source === "WALK_IN" ? "CASH" : "VNPAY", status: "SUCCESS", reconciled: i % 3 !== 0, date: b.createdAt }];
  if (b.paid > b.deposit) list.push({ id: `PM${1002 + i * 2}`, bookingId: b.id, amount: b.paid - b.deposit, method: "CARD", status: "SUCCESS", reconciled: i % 2 === 0, date: b.checkOut });
  return list;
}).concat([{ id: "PM1099", bookingId: "BK2404", amount: 555000, method: "VNPAY", status: "FAILED", reconciled: false, date: day(-1) }]);

export const services: Service[] = [
  { id: "s1", name: "Bữa sáng tại phòng", category: "Ẩm thực", price: 280000, active: true },
  { id: "s2", name: "Giặt ủi", category: "Buồng phòng", price: 150000, active: true },
  { id: "s3", name: "Đưa đón sân bay", category: "Di chuyển", price: 450000, active: true },
  { id: "s4", name: "Massage spa đặc trưng", category: "Chăm sóc sức khoẻ", price: 900000, active: true },
  { id: "s5", name: "Giường phụ", category: "Buồng phòng", price: 350000, active: true },
  { id: "s6", name: "Thuê xe đạp", category: "Giải trí", price: 120000, active: false },
];

const active = bookings.filter((b) => b.status === "CHECKED_IN");
export const serviceOrders: ServiceOrder[] = Array.from({ length: 10 }, (_, i) => ({
  id: `SO${301 + i}`, bookingId: active[i % active.length].id, serviceId: services[i % 5].id, qty: 1 + (i % 2),
  status: (["PENDING", "IN_PROGRESS", "DONE", "PENDING", "DONE", "CANCELLED"] as const)[i % 6], createdAt: day(-(i % 3)),
  note: i % 3 === 0 ? "Vui lòng giao sau 8 giờ sáng" : undefined, assignee: i % 2 ? "Mai Phương" : undefined,
}));

export const staffNames = { service: ["Mai Phương", "Quang Vinh", "Ánh Dương"], ops: ["Bùi Tiến", "Lý Khôi"] };

export const tasks: Task[] = [
  ...rooms.filter((r) => r.status === "CLEANING").map((r, i) => ({ id: `T${501 + i}`, title: `Dọn dẹp phòng ${r.number}`, type: "CLEANING" as const, roomId: r.id, role: "SERVICE_STAFF" as const, assignee: staffNames.service[i % 3], status: "OPEN" as const, priority: "HIGH" as const, due: day(0) })),
  { id: "T520", title: "Giao bữa sáng phòng 203", type: "SERVICE", roomId: "r9", role: "SERVICE_STAFF", assignee: "Mai Phương", status: "IN_PROGRESS", priority: "MEDIUM", due: day(0) },
  { id: "T521", title: "Bổ sung minibar tầng 2", type: "SERVICE", roomId: "r8", role: "SERVICE_STAFF", assignee: "Quang Vinh", status: "DONE", priority: "LOW", due: day(-1) },
  { id: "T530", title: "Sửa điều hoà rò nước", type: "MAINTENANCE", roomId: "r8", role: "OPERATIONS_STAFF", assignee: "Bùi Tiến", status: "IN_PROGRESS", priority: "HIGH", due: day(0) },
  { id: "T531", title: "Thay đèn phòng tắm", type: "MAINTENANCE", roomId: "r16", role: "OPERATIONS_STAFF", assignee: "Lý Khôi", status: "OPEN", priority: "MEDIUM", due: day(1) },
  { id: "T532", title: "Kiểm tra máy bơm hồ bơi", type: "MAINTENANCE", roomId: "r1", role: "OPERATIONS_STAFF", assignee: "Bùi Tiến", status: "DONE", priority: "LOW", due: day(-2) },
];

export const equipment: Equipment[] = rooms.slice(0, 16).flatMap((r, i) => [
  { id: `E${100 + i * 2}`, name: "Điều hoà", roomId: r.id, condition: (r.status === "MAINTENANCE" ? "BROKEN" : i % 5 === 0 ? "NEEDS_REPAIR" : "GOOD") as Equipment["condition"], lastService: day(-30 - i * 4) },
  { id: `E${101 + i * 2}`, name: i % 2 ? "TV thông minh" : "Tủ lạnh minibar", roomId: r.id, condition: "GOOD" as const, lastService: day(-60 - i * 3) },
]);

export const issues: Issue[] = [
  { id: "IS71", title: "Điều hoà bị rò nước", roomId: "r8", reportedBy: "Khách phòng 202", severity: "HIGH", status: "IN_PROGRESS", createdAt: day(-1), description: "Nước nhỏ từ dàn lạnh xuống thảm.", equipmentId: "E114", assignee: "Bùi Tiến" },
  { id: "IS72", title: "Đèn phòng tắm nhấp nháy", roomId: "r16", reportedBy: "Mai Phương", severity: "MEDIUM", status: "REPORTED", createdAt: day(0), description: "Đèn trần nhấp nháy liên tục." },
  { id: "IS73", title: "Wi‑Fi yếu ngoài ban công", roomId: "r20", reportedBy: "Khách phòng 402", severity: "LOW", status: "REPORTED", createdAt: day(-2), description: "Mất sóng khi ra ban công." },
  { id: "IS74", title: "Khoá cửa sắp hết pin", roomId: "r3", reportedBy: "Lễ tân", severity: "MEDIUM", status: "RESOLVED", createdAt: day(-5), description: "Khoá kêu bíp khi mở." },
];

export const maintenance: Maintenance[] = [
  { id: "M1", equipmentId: "E104", issueId: "IS74", date: day(-4), technician: "Lý Khôi", action: "Thay pin khoá cửa", cost: 120000 },
  { id: "M2", equipmentId: "E100", date: day(-12), technician: "Bùi Tiến", action: "Vệ sinh điều hoà định kỳ quý", cost: 350000 },
  { id: "M3", equipmentId: "E110", date: day(-20), technician: "Bùi Tiến", action: "Nạp gas điều hoà", cost: 800000 },
];

export const feedback: Feedback[] = bookings.filter((b) => b.status === "CHECKED_OUT").map((b, i) => ({
  id: `F${i + 1}`, bookingId: b.id, guestId: b.guestId, rating: [5, 4, 5, 3][i % 4], date: b.checkOut,
  comment: ["Kỳ nghỉ tuyệt vời — nhân viên còn nhớ tên chúng tôi.", "Phòng rất đẹp, bữa sáng nên bắt đầu sớm hơn.", "Suite hướng biển đẹp ngỡ ngàng.", "Sạch sẽ và yên tĩnh, nhưng làm thủ tục nhận phòng hơi lâu."][i % 4],
  reply: i % 2 === 0 ? "Xin cảm ơn — mong sớm được đón quý khách trở lại." : undefined,
}));

export const amenities: Amenity[] = ["Wi‑Fi", "Điều hoà", "Hướng biển", "Minibar", "Bồn tắm", "TV thông minh", "Sen mưa", "Bàn làm việc", "Quản gia riêng", "Máy pha espresso"].map((n, i) => ({ id: `a${i + 1}`, name: n, category: i < 2 ? "Essentials" : i < 6 ? "Comfort" : "Premium" }));

export const accounts: Account[] = [
  { id: "u1", name: "Nguyễn Minh Anh", email: "minh.anh@mail.com", role: "CUSTOMER", active: true },
  { id: "u2", name: "Trịnh Hải Yến", email: "yen.reception@emilyhotel.vn", role: "RECEPTIONIST", active: true },
  { id: "u3", name: "Mai Phương", email: "phuong.service@emilyhotel.vn", role: "SERVICE_STAFF", active: true },
  { id: "u4", name: "Bùi Tiến", email: "tien.ops@emilyhotel.vn", role: "OPERATIONS_STAFF", active: true },
  { id: "u5", name: "Lý Khôi", email: "khoi.ops@emilyhotel.vn", role: "OPERATIONS_STAFF", active: false },
  { id: "u6", name: "Đỗ Thanh Tâm", email: "tam.manager@emilyhotel.vn", role: "MANAGER", active: true },
  { id: "u7", name: "Quang Vinh", email: "vinh.service@emilyhotel.vn", role: "SERVICE_STAFF", active: true },
];

export const permissions = ["Quản lý đặt phòng", "Nhận / trả phòng", "Đặt phòng tại quầy", "Đối soát thanh toán", "Xử lý yêu cầu dịch vụ", "Xử lý bảo trì", "Quản lý phòng & loại phòng", "Quản lý tài khoản & vai trò", "Xem báo cáo"];
export const rolePermissions: Record<string, string[]> = {
  RECEPTIONIST: ["Quản lý đặt phòng", "Nhận / trả phòng", "Đặt phòng tại quầy", "Đối soát thanh toán"],
  SERVICE_STAFF: ["Xử lý yêu cầu dịch vụ"],
  OPERATIONS_STAFF: ["Xử lý bảo trì"],
  MANAGER: permissions,
  CUSTOMER: [],
};

export const notifications: Notification[] = [
  { id: "n1", title: "Đặt phòng trực tuyến mới", body: "BK2408 · Deluxe Giường King · 3 đêm", date: day(0), read: false, roles: ["RECEPTIONIST", "MANAGER"] },
  { id: "n2", title: "Sự cố ưu tiên cao", body: "Điều hoà phòng 202 rò nước", date: day(-1), read: false, roles: ["OPERATIONS_STAFF", "MANAGER"] },
  { id: "n3", title: "Có yêu cầu dịch vụ mới", body: "Bữa sáng tại phòng 203", date: day(0), read: false, roles: ["SERVICE_STAFF"] },
  { id: "n4", title: "Đã xác nhận đặt cọc", body: "Đặt phòng BK2401 của bạn đã được xác nhận.", date: day(-2), read: true, roles: ["CUSTOMER"] },
  { id: "n5", title: "Thanh toán chưa đối soát", body: "6 giao dịch VNPay đang chờ kiểm tra", date: day(-1), read: false, roles: ["RECEPTIONIST", "MANAGER"] },
];

export const seed = { roomTypes, rooms, guests, bookings, payments, services, serviceOrders, tasks, issues, equipment, maintenance, feedback, amenities, accounts, notifications, rolePermissions };
export type Data = typeof seed;
