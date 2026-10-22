# Module nghiệp vụ

Mỗi nhóm chức năng là một module NestJS riêng trong thư mục này. Tạo nhanh bằng CLI:

```bash
npx nest g resource modules/rooms --no-spec   # controller + service + DTO + module
```

Cấu trúc khuyến nghị cho một module:

```
rooms/
├── dto/                  # class-validator DTO cho request/response
├── schemas/              # Mongoose schema (@Schema, @Prop)
├── rooms.controller.ts   # chỉ nhận request, gọi service
├── rooms.service.ts      # logic nghiệp vụ, business rule (BR-xxx)
├── rooms.service.spec.ts
└── rooms.module.ts
```

Danh sách module dự kiến (theo SRS và phân công Sprint 1):

| Module | Use case | Phụ trách |
|---|---|---|
| `auth`, `users`, `roles` | UC01–04, UC42–46, RBAC | Vũ Ngọc Dương |
| `feedback` | UC39–41 | Dương (UC40–41), Khoa (UC39) |
| `rooms`, `room-types`, `amenities`, `services` | UC47–54 | Trần Bảo Lâm |
| `equipment`, `maintenance` | UC35–36 | Trần Bảo Lâm |
| `notifications` (Gmail) | BR-NOTI | Trần Bảo Lâm |
| `reports` | UC55–57, Manager Dashboard | Trần Bảo Lâm |
| `bookings`, `room-holds` | UC05–07, UC09, UC12, My Bookings | Nguyễn Công Hiếu |
| `invoices`, `payments` (VNPay) | UC19–21 | Nguyễn Công Hiếu |
| `front-desk` | UC08, UC10–11, UC13–18 | Nguyễn Đăng Khoa |
| `tasks` | Task core, UC37–38 | Lê Anh Vũ |
| `service-orders` | UC22–27 | Lê Anh Vũ |
| `issues` | UC28–34 | Lê Anh Vũ |

Quy ước:

- Import nội bộ dùng đuôi `.js` (dự án chạy ESM, `"type": "module"`).
- Endpoint mặc định cần đăng nhập; endpoint cho Guest gắn `@Public()`.
- Giới hạn role bằng `@Roles(Role.Manager, ...)` (xem `common/`).
- Không đọc `process.env` trực tiếp trong module, dùng `ConfigService`.
