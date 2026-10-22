# Tiến độ phần việc của Vũ Ngọc Dương

> Viết cho thành viên và AI agent của các thành viên khác đọc trước khi code. Cập nhật 23/10/2026: đã nối Firebase project `hrm-wdp`.
> Phân công gốc: [README mục 7](../README.md#7-kế-hoạch-sprint-1-và-phân-công), cách phối hợp: [HUONG-DAN-TRIEN-KHAI.md](HUONG-DAN-TRIEN-KHAI.md).

## Đọc nhanh

- Đăng nhập, phân quyền, tài khoản, vai trò, phản hồi (UC01–04, UC40–46) **đã xong và đã ở `main`**.
- **Mọi endpoint mặc định cần đăng nhập.** Endpoint cho khách vãng lai phải gắn `@Public()`, giới hạn vai trò bằng `@Roles()`.
- Chưa có Firebase vẫn test được theo vai trò: header `x-dev-role` / `x-dev-user-id` (backend) và màn đăng nhập dev (frontend).
- `npm run seed` tạo 5 vai trò, 15 permission, 5 tài khoản mẫu, 3 phản hồi mẫu. Module của bạn thêm seed vào `SEEDS`.
- Còn chờ người khác: schema `Booking` của Hiếu (để seed booking `CHECKED_IN`), layout theo role của Khoa (H10).

## 1. Trạng thái task

| # | Task | Trạng thái | PR |
|---|---|---|---|
| H1 | Quy ước dữ liệu chung | Xong | #1 |
| H2 | `@CurrentUser()`, header giả lập role, schema `User` | Xong | #1 |
| 13 | Repo, khung BE/FE, CI, convention | Xong | — |
| 14 | DB + seed | Xong phần của Dương (User, Role, Permission, seed tổng). **Thiếu booking `CHECKED_IN` mẫu: chờ schema `Booking` (Hiếu)** | #2 |
| 15 | Xác thực Firebase + RBAC | Xong, thêm `@Permissions()` ở #9 | #3, #9 |
| 16, 17 | UC02 Login, UC03 Logout | Xong | #4 |
| 19, 20 | UC01 Register, UC04 Update Profile | Xong | #5, #9 |
| 21, 22 | UC42 Account List, UC43 Create/Update Account | Xong | #6, #9 |
| 23, 24, 25 | UC44 Role List, UC46 Create/Update Role, UC45 Assign Permissions | Xong | #7, #9 |
| 26, 27 | UC40 Feedback List, UC41 Reply to Feedback | Xong | #8 |

Firebase project của nhóm là `hrm-wdp` (Email/Password đã bật, Web app "HMS"); đã nối frontend và backend: trang đăng nhập dùng Firebase thật, backend kiểm tra ID token của project này. Mọi luồng đã chạy thử ở chế độ dev và có test e2e trên MongoDB; đăng ký, xác minh email, đăng nhập bằng tài khoản Firebase thật do Dương thử thủ công.

## 2. Dùng lại được ngay

### 2.1 Backend: xác thực và phân quyền

`AuthGuard` và `RolesGuard` đăng ký toàn cục (`modules/auth/auth.module.ts`), không cần gắn vào controller.

```ts
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';

@Public()                                   // khách vãng lai gọi được
@Roles(Role.Receptionist, Role.Manager)     // chỉ các role này (SRS ghi rõ ai được làm)
@Permissions('task:execute')                // role do Manager tự tạo có permission này cũng qua (UC45)
handler(@CurrentUser() user: AuthUser) {}   // user = { id, email, role }; undefined nếu @Public và chưa đăng nhập
```

- Thứ tự kiểm tra: không đăng nhập hoặc token sai → 401; email chưa xác minh hoặc tài khoản bị khoá → 403; role không nằm trong `@Roles()` và cũng không có đủ permission trong `@Permissions()` → 403.
- `@Permissions()` chỉ đọc DB khi role không có sẵn trong `@Roles()`. Mã permission ở `modules/roles/seed.ts` (`PERMISSIONS`), ví dụ `task:execute`, `issue:manage`, `facility:manage`, `report:view`.
- `Role` (enum) gồm `CUSTOMER`, `RECEPTIONIST`, `SERVICE_STAFF`, `OPERATIONS_STAFF`, `MANAGER`.

**Test khi chưa có Firebase** (chỉ khi `NODE_ENV` khác `production`): gửi header `x-dev-role: MANAGER` và, nếu API cần User thật trong DB, `x-dev-user-id: <_id>` (seed in ra `_id`). Swagger `/api/docs` có nút **Authorize** để điền hai header này.

### 2.2 Backend: dữ liệu

- **`User`** (`modules/users/schemas/user.schema.ts`, collection `users`): `firebaseUid?`, `email` (duy nhất, viết thường), `fullName`, `phone?`, `emailVerified`, `role`, `isActive`.
  - `role` lưu **mã role dạng chuỗi** (`'MANAGER'`), không phải ObjectId. Mã role không bao giờ đổi (BR-RBAC-05).
  - `isActive: false` = tài khoản bị khoá; dữ liệu cũ của tài khoản đó vẫn giữ (BR-RBAC-04).
  - Tham chiếu tới User từ schema của bạn: `@Prop({ type: Types.ObjectId, ref: 'User' })`.
- **`Role`, `Permission`** (`modules/roles/schemas/`): `Role.permissions` là mảng mã permission.
- **Quy ước chung** (`common/database/conventions.ts`): `@Schema({ timestamps: true })`, xoá mềm bằng `isActive`, tiền là số nguyên VND (`isMoneyVnd()`), ngày nghiệp vụ theo giờ Việt Nam bằng `toBusinessDate()` (chuỗi `YYYY-MM-DD`).
- **Seed** (`src/database/seed.ts`): mỗi module viết `modules/<tên>/seed.ts` export hàm kiểu `Seed`, ghi bằng `updateOne(filter, { $setOnInsert }, { upsert: true })`, rồi thêm vào `SEEDS` theo thứ tự phụ thuộc (hiện là `roles` → `users` → `feedback`). Tài khoản mẫu: `customer@`, `receptionist@`, `service@`, `operations@`, `manager@` + `hms.local`.
- `ValidationPipe` toàn cục bật `whitelist` + `forbidNonWhitelisted`: field không khai báo trong DTO sẽ bị 400.

### 2.3 API đã có (prefix `/api/v1`)

| Method, path | Ai gọi | Ghi chú |
|---|---|---|
| `GET /auth/me` | Đã đăng nhập | `{ id, email, fullName, phone, role, permissions }` |
| `POST /auth/register` | Public | Header `Authorization: Bearer <ID token Firebase vừa tạo>`, body `{ fullName, phone? }`; luôn tạo Customer |
| `GET /auth/dev-accounts` | Public, dev | Danh sách tài khoản cho màn đăng nhập dev; 404 ở production |
| `PATCH /users/me` | Đã đăng nhập | `{ fullName?, phone? }`; `phone: ''` để xoá số |
| `GET /users` | Manager | `?search=&role=&isActive=&page=&limit=` → `{ items, total, page, limit }` |
| `GET /users/:id`, `POST /users`, `PATCH /users/:id` | Manager | Tạo: `{ email, fullName, phone?, role, password }`; sửa: `{ fullName?, phone?, role?, isActive? }` |
| `GET /roles`, `GET /roles/:id`, `GET /permissions` | Manager | `roles` kèm `userCount` |
| `POST /roles`, `PATCH /roles/:id` | Manager | Mã role tự viết hoa, không sửa được |
| `PUT /roles/:id/permissions` | Manager | `{ permissions: string[] }` (danh sách đầy đủ) |
| `GET /feedback`, `GET /feedback/:id` | Lễ tân, Manager | `?search=&rating=&replied=&page=&limit=` |
| `POST /feedback/:id/reply` | Lễ tân | `{ content }`; đã trả lời → 409 |

### 2.4 Frontend

- **Người dùng hiện tại**: `const { me, status, logout } = useAuth()` (`features/auth/auth-context.ts`); `me` có `id, email, fullName, phone, role, permissions`.
- **Chặn route**: bọc trang bằng `RequireAuth`:
  ```tsx
  { path: 'staff/tasks', element: <RequireAuth roles={['SERVICE_STAFF']} permissions={['task:execute']}><TasksPage /></RequireAuth> }
  ```
  Chưa đăng nhập → chuyển về `/login` rồi quay lại; không có quyền → trang "Không có quyền truy cập".
- **Gọi API**: dùng `api` trong `lib/api-client.ts`, token Firebase hoặc header dev được gắn tự động. Thông báo lỗi: `getErrorMessage(error)`.
- **Route của feature**: mỗi feature export mảng `routes.tsx`, gộp vào `app/router.tsx` (xem `features/accounts/routes.tsx`). Route đã dùng: `/login`, `/register`, `/profile`, `/manager/accounts`, `/manager/roles`, `/staff/feedback`.
- **Component dùng chung** (`src/components`): `Button` (variant primary/secondary/ghost/danger, `loading`), `TextField`, `SelectField`, `Alert`, `Badge`. Bảng, form, badge theo DESIGN.md (xem `features/accounts/pages/AccountsPage.tsx` làm mẫu).
- **Test component cần đăng nhập**: `renderWithAuth(routes, { auth: { me: {...ME, role: 'MANAGER'}, status: 'authenticated' } })` trong `features/auth/test-utils.tsx`.
- **Menu tạm**: `ROLE_LINKS` trong `features/auth/UserMenu.tsx` (link theo role trên header). Layout theo role (H10) thay thế phần này.

## 3. Bàn giao và việc đang chờ

| Ai | Việc | Ghi chú |
|---|---|---|
| Hiếu | Schema `Booking` (H5) + seed `bookings` có ít nhất một booking `CHECKED_IN` | Thêm `bookings` vào `SEEDS` sau `users`. Sau đó đổi id booking cố định trong `modules/feedback/seed.ts` sang booking thật (`TODO(#46)`) |
| Khoa | Review schema `Feedback` (`modules/feedback/schemas/feedback.schema.ts`) | Hợp đồng chung với UC39. Unique index `{ customer, booking }` = một phản hồi cho mỗi booking (BR-FB-03); đổi chính sách thì sửa index này |
| Khoa | UC39 Submit Feedback | Thêm `POST /feedback` (`@Roles(Role.Customer)`) vào `FeedbackController`, kiểm tra booking thuộc khách và đã `CHECKED_OUT` |
| Khoa | Layout theo role (H10) | Chuyển `ROLE_LINKS` của `UserMenu` vào menu layout; có thể bọc `RequireAuth` ở route cha |
| Vũ, Lâm | Gắn `@Permissions()` cho endpoint của nhân viên (task, sự cố, bảo trì) | Để role do Manager tạo thêm (ví dụ `HOUSEKEEPING` có `task:execute`) dùng được |
| Cả nhóm | Bật Firebase khi dev (không bắt buộc) | Điền config Web của `hrm-wdp` theo [HUONG-DAN-TRIEN-KHAI.md mục 2.4](HUONG-DAN-TRIEN-KHAI.md#24-firebase-của-nhóm); service account xin Dương qua kênh riêng |

## 4. Lưu ý khi sửa code liên quan

- Không đổi `User.role` sang ObjectId, không cho sửa `Role.code`: guard và mọi `@Roles()` dựa vào mã role.
- Đừng bỏ `DevAuthMiddleware`: cả nhóm đang test bằng header dev. Nó tự tắt ở production.
- Endpoint mới mà quên `@Public()` sẽ trả 401 với khách vãng lai (ví dụ tìm phòng, xem phòng).
- Test e2e (`backend/test/*.e2e-spec.ts`) dùng chung một database và chạy lần lượt: mỗi file tự tạo dữ liệu với email riêng (ví dụ `@accounts-e2e.vn`) và tự xoá khi xong; không `deleteMany({})` collection của module khác.
- Import nội bộ backend có đuôi `.js` (ESM); không đọc `process.env` trong module, dùng `ConfigService`.

## 5. Hạn chế đã biết

- Đăng xuất chỉ xoá phiên trên trình duyệt; ID token đã cấp còn dùng được tới khi hết hạn (tối đa khoảng 1 giờ).
- Tài khoản mẫu `@hms.local` không xác minh được email trên Firebase thật, chỉ dùng cho chế độ dev.
- Backend chưa điền service account Firebase thì tài khoản Manager tạo chỉ tồn tại trong HMS (không đăng nhập Firebase được); production sẽ báo 503 thay vì tạo thiếu.
- Muốn có tài khoản Manager thật để thử: đăng ký ở `/register`, xác minh email, rồi dùng Swagger với header `x-dev-role: MANAGER` gọi `PATCH /users/{id}` với `{ "role": "MANAGER" }`.
- Header dev `x-dev-role` chỉ nhận 5 role hệ thống; role tự tạo kiểm tra bằng unit test hoặc Firebase thật.

## 6. Kiểm tra nhanh

```bash
cd backend && npm run lint && npm run typecheck && npm test && npm run test:e2e   # e2e cần MongoDB
cd frontend && npm run lint && npm run typecheck && npm test
```
