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
- Schema theo quy ước dữ liệu chung ở `common/database/conventions.ts`: `timestamps: true`, xoá mềm bằng `isActive`, tiền là số nguyên VND, ngày nghiệp vụ lấy bằng `toBusinessDate()`.
- Lấy người dùng hiện tại bằng `@CurrentUser() user: AuthUser` (`{ id, email, role }`).
- Test theo role khi chưa có Firebase: gửi header `x-dev-role: MANAGER` (và `x-dev-user-id: <_id User>` nếu cần) qua Swagger (nút Authorize) hoặc Postman. Chỉ có tác dụng khi `NODE_ENV` khác `production`.

## Seed dữ liệu mẫu

```bash
npm run seed                          # chạy trực tiếp (cần backend/.env)
docker compose exec backend npm run seed   # khi chạy bằng Docker
```

Chạy lại nhiều lần vẫn an toàn: chỉ thêm bản ghi còn thiếu, không ghi đè dữ liệu đã sửa. Log in ra `_id` của 5 tài khoản mẫu (`customer`, `receptionist`, `service`, `operations`, `manager` + `@hms.local`) để dùng cho header `x-dev-user-id`.

Thêm seed cho module của mình:

1. Viết `modules/<tên>/seed.ts` export một hàm kiểu `Seed` (xem `src/database/seed.ts`). Lấy model bằng `app.get(getModelToken(X.name))`, ghi bằng `updateOne(..., { $setOnInsert }, { upsert: true })` theo một khóa duy nhất.
2. Thêm hàm đó vào `SEEDS` trong `src/database/seed.ts`, đặt sau các seed mà dữ liệu của mình tham chiếu tới (ví dụ `bookings` sau `rooms` và `users`).
