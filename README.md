# Grand Emily HMS — Hotel Management System

Hệ thống quản lý khách sạn chạy trên web: khách tìm và đặt phòng online, đặt cọc qua VNPay; lễ tân quản lý booking, check-in/check-out; nhân viên nhận và cập nhật công việc; quản lý theo dõi vận hành, cơ sở vật chất và doanh thu.

Tài liệu nguồn: **SRS - HMS** (Hanoi, 09/2025), giao diện theo [`DESIGN.md`](DESIGN.md).

[![CI](https://github.com/duongvn9/hotel-mangagement-system/actions/workflows/ci.yml/badge.svg)](https://github.com/duongvn9/hotel-mangagement-system/actions/workflows/ci.yml)

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Tech stack](#2-tech-stack)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Chạy dự án](#4-chạy-dự-án)
5. [Biến môi trường](#5-biến-môi-trường)
6. [Quy ước làm việc](#6-quy-ước-làm-việc)
7. [Kế hoạch Sprint 1 và phân công](#7-kế-hoạch-sprint-1-và-phân-công)

---

## 1. Tổng quan dự án

### 1.1 Người dùng (actor)

| Actor | Vai trò |
|---|---|
| **Guest** | Chưa đăng nhập: tìm phòng, xem chi tiết phòng, đặt phòng, đặt cọc, đăng ký tài khoản |
| **Customer** | Khách đã đăng ký: quản lý hồ sơ, đặt và theo dõi booking, thanh toán, đặt dịch vụ, báo sự cố, gửi phản hồi |
| **Receptionist** | Lễ tân: quản lý booking, check-in/check-out, sơ đồ phòng, duyệt yêu cầu dịch vụ và sự cố, hóa đơn, phản hồi |
| **Service Staff** | Nhân viên dịch vụ: thực hiện task dịch vụ và xử lý sự cố, cập nhật tiến độ, báo sự cố dịch vụ |
| **Operations Staff** | Nhân viên vận hành: task bảo trì, báo hỏng thiết bị, xem lịch sử bảo trì |
| **Manager** | Quản lý: tài khoản và phân quyền, phòng/loại phòng/tiện nghi/dịch vụ, theo dõi hàng đợi task, sự cố, báo cáo |

### 1.2 Nhóm chức năng (57 use case)

| Nhóm | Use case |
|---|---|
| Tài khoản & Hồ sơ | UC01 Register, UC02 Login, UC03 Logout, UC04 Update Profile |
| Tìm phòng & Đặt phòng | UC05 Search Available Rooms, UC06 View Room Details, UC07 Create Booking, UC08 Create Booking for Guest, UC09 View Booking Detail, UC10 View Booking List, UC11 Update Booking, UC12 Cancel Booking |
| Lễ tân / Check-in / Check-out | UC13 Room Status Board, UC14 Search Guest Profile, UC15 Same-Day Check-In/Out List, UC16 Check In, UC17 Record Checkout Additional Charge, UC18 Check Out |
| Hóa đơn & Thanh toán | UC19 View Invoice Detail, UC20 Make Deposit Payment, UC21 Pay Final Invoice |
| Đặt dịch vụ | UC22–UC27: tạo, xem, duyệt, giao task, lịch sử Service Order |
| Quản lý sự cố | UC28–UC34: báo, xem, duyệt, giao xử lý, đóng sự cố, báo sự cố dịch vụ |
| Bảo trì | UC35 Report Equipment Fault, UC36 View Maintenance History |
| Công việc nhân viên | UC37 View Assigned Tasks, UC38 Update Task Progress |
| Phản hồi | UC39 Submit Feedback, UC40 View Feedback List, UC41 Reply to Feedback |
| Phân quyền | UC42–UC46: danh sách/tạo/sửa tài khoản, role, gán quyền |
| Cơ sở vật chất | UC47–UC54: phòng, loại phòng, tiện nghi, dịch vụ |
| Giám sát & Báo cáo | UC55 Monitor Task Queues, UC56 Revenue Report, UC57 Operational Report |

### 1.3 Dữ liệu chính (16 entity)

`User`, `Role`, `Permission`, `RoomType`, `Room`, `Amenity`, `Booking` (nhiều phòng), `RoomHold` (giữ phòng tạm khi đặt), `Service`, `ServiceOrder`, `Equipment`, `Issue`, `Task`, `Invoice`, `PaymentTransaction`, `Feedback`.

### 1.4 Tích hợp bên ngoài

| Dịch vụ | Dùng cho |
|---|---|
| Firebase Authentication | Đăng ký, xác minh email, đăng nhập (BR-INT-01/02) |
| VNPay Payment Gateway | Đặt cọc và thanh toán hóa đơn cuối (UC20, UC21), callback phải idempotent |
| Gmail | Gửi thông báo, có log lỗi và retry (BR-NOTI) |

---

## 2. Tech stack

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, React Router 8, TanStack Query 5, Axios, Tailwind CSS 4 (preset từ `design-system/`) |
| Backend | NestJS 12 (ESM), TypeScript, Mongoose 9, class-validator, Joi (kiểm tra env), Swagger, Terminus (health check), Helmet |
| Database | MongoDB 8 |
| Test & lint | Vitest, Testing Library, Supertest, Oxlint, Prettier |
| Hạ tầng | Docker (multi-stage), Docker Compose (dev có hot reload, production qua nginx), GitHub Actions CI |
| Runtime | Node.js 24 LTS, npm 11 |

---

## 3. Cấu trúc thư mục

```
.
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── main.ts             # bootstrap: prefix /api, version v1, helmet, CORS, validation, Swagger
│   │   ├── app.module.ts       # Config + Mongo + các module
│   │   ├── config/             # configuration.ts + env.validation.ts (Joi)
│   │   ├── common/             # Role enum, @Roles, @Public, exception filter
│   │   └── modules/            # mỗi nhóm chức năng 1 module (xem modules/README.md)
│   ├── test/                   # e2e test (cần MongoDB)
│   └── Dockerfile              # target: dev | prod
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── app/                # App, router, query client
│   │   ├── components/         # component dùng chung
│   │   ├── features/           # mỗi nhóm chức năng 1 thư mục (xem features/README.md)
│   │   ├── layouts/  pages/
│   │   ├── lib/                # api-client (axios), env
│   │   └── styles/index.css    # import token + Tailwind
│   ├── nginx.conf              # dùng cho image production
│   └── Dockerfile              # target: dev | prod (build context = thư mục gốc)
├── design-system/              # token màu, font, Tailwind preset (nguồn chuẩn cho UI)
├── DESIGN.md                   # hướng dẫn design system
├── docker-compose.yml          # môi trường dev
├── docker-compose.prod.yml     # môi trường production
├── .env.example                # mẫu biến môi trường cho Docker Compose
└── .github/workflows/ci.yml    # lint, test, build, build image
```

---

## 4. Chạy dự án

### 4.1 Yêu cầu

- Docker Desktop (Compose v2.22 trở lên để dùng `--watch`)
- Node.js 24 và npm 11 nếu muốn chạy ngoài Docker (`nvm use` sẽ đọc `.nvmrc`). Lockfile tạo bằng npm 11, dùng npm 10 có thể báo lỗi khi `npm ci`.

### 4.2 Dev bằng Docker (khuyên dùng)

```bash
git clone https://github.com/duongvn9/hotel-mangagement-system.git
cd hotel-mangagement-system
docker compose up --build --watch      # hoặc: make dev
docker compose exec backend npm run seed   # terminal khác, sau khi container đã chạy: tạo dữ liệu mẫu
```

Máy đã cài sẵn MongoDB (cổng 27017 bị chiếm) thì cho MongoDB của Docker dùng cổng khác: `MONGO_PORT=27018 docker compose up --build --watch` (hoặc đặt `MONGO_PORT=27018` trong `.env`).

| Địa chỉ | Nội dung |
|---|---|
| http://localhost:5173 | Frontend (Vite, hot reload) |
| http://localhost:3000/api/v1/health | Backend health check |
| http://localhost:3000/api/docs | Swagger API docs |
| mongodb://hms:hms_dev_password@localhost:27017/hms?authSource=admin | MongoDB (mở bằng Compass) |
| http://localhost:8081 | mongo-express, chạy với `docker compose --profile tools up --watch` |

- `--watch` tự đồng bộ `backend/src`, `frontend/src`, `design-system/` vào container; sửa `package-lock.json` thì container tự build lại.
- Cài thêm thư viện: chạy `npm install <pkg>` trong `backend/` hoặc `frontend/` trên máy, compose sẽ tự rebuild.
- Xóa sạch dữ liệu Mongo dev: `docker compose down -v`.

### 4.3 Dev không dùng Docker

```bash
docker compose up -d mongo                         # chỉ chạy MongoDB

cd backend && cp .env.example .env && npm ci && npm run seed && npm run start:dev
cd frontend && cp .env.example .env.local && npm ci && npm run dev
```

Dùng MongoDB cài trên máy (không đặt mật khẩu) thay cho Docker: sửa `backend/.env` thành `MONGODB_URI=mongodb://127.0.0.1:27017/hms`.

Lệnh hay dùng (chạy trong `backend/` hoặc `frontend/`):

| Lệnh | Việc |
|---|---|
| `npm run lint` | Oxlint |
| `npm run format` | Prettier |
| `npm test` | Unit test (Vitest) |
| `npm run test:e2e` | E2E backend (cần MongoDB đang chạy) |
| `npm run seed` | Tạo dữ liệu mẫu (backend). Chạy lại nhiều lần vẫn an toàn, không ghi đè dữ liệu đã sửa |
| `npm run build` | Build production |

### Lỗi thường gặp

- **MongoDB thoát ngay khi khởi động, log có "Linux kernel versions 6.19 and newer has a known incompatibility"**: MongoDB (mọi bản, kể cả Docker) không chạy trên kernel Linux 6.19 đến 7.0.13 ([ghi chú của MongoDB](https://www.mongodb.com/docs/manual/release-notes/8.0)). Cập nhật Docker Desktop hoặc kernel lên 7.0.14 trở lên; nếu chưa được thì tạm dùng MongoDB Atlas (gói free) và đặt `MONGODB_URI` trỏ tới đó.
- **`npm ci` báo lockfile không khớp**: kiểm tra `node -v` là 24 và `npm -v` là 11.

### 4.4 Đăng nhập khi dev

Chưa điền Firebase (`VITE_FIREBASE_*` ở frontend, `FIREBASE_PROJECT_ID` ở backend) thì trang http://localhost:5173/login hiện danh sách tài khoản mẫu, bấm vào là đăng nhập (frontend gửi header `x-dev-user-id`, `x-dev-role`; backend chỉ nhận khi `NODE_ENV` khác `production`). Danh sách trống thì chạy `npm run seed`.

| Tài khoản mẫu | Thử được |
|---|---|
| `manager@hms.local` | `/manager/accounts` (tài khoản), `/manager/roles` (vai trò, phân quyền), `/staff/feedback` (xem phản hồi) |
| `receptionist@hms.local` | `/staff/feedback` (xem, trả lời phản hồi) |
| `customer@hms.local`, `service@hms.local`, `operations@hms.local` | `/profile` (hồ sơ), đăng xuất |

- Thử API trên Swagger http://localhost:3000/api/docs: bấm **Authorize**, điền `x-dev-role` (ví dụ `MANAGER`), thêm `x-dev-user-id` (lấy `_id` in ra khi chạy seed) nếu API cần User thật.
- Có Firebase: điền `FIREBASE_PROJECT_ID` (đủ để kiểm tra đăng nhập) vào `backend/.env` và `VITE_FIREBASE_*` vào `frontend/.env.local`. Trang đăng nhập chuyển sang email/mật khẩu, `/register` dùng được. Muốn Manager tạo được tài khoản nhân viên trên Firebase thì điền thêm `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (service account).
- Tài khoản mẫu dùng email `@hms.local` nên không xác minh được trên Firebase thật: chỉ dùng cho chế độ dev.

### 4.5 Production

```bash
cp .env.example .env          # điền MONGO_ROOT_PASSWORD, CORS_ORIGINS, secret Firebase/VNPay/Gmail
docker compose -f docker-compose.prod.yml up -d --build    # hoặc: make prod
```

- Chỉ container `web` (nginx, cổng `WEB_PORT`, mặc định 80) mở ra ngoài. nginx phục vụ file tĩnh của React và chuyển `/api/*` vào `backend`.
- `backend` và `mongo` nằm trong mạng nội bộ, MongoDB không mở cổng.
- Image chạy bằng user không phải root, có healthcheck, log giới hạn 10 MB × 3 file.
- Swagger tắt mặc định ở production (`SWAGGER_ENABLED=false`).
- HTTPS: đặt reverse proxy có TLS (Caddy, Traefik, Nginx Proxy Manager, Cloudflare Tunnel…) phía trước cổng `WEB_PORT`.

---

## 5. Biến môi trường

| File | Dùng khi |
|---|---|
| `.env.example` → `.env` | Docker Compose (dev không bắt buộc, production bắt buộc) |
| `backend/.env.example` → `backend/.env` | Chạy backend trực tiếp bằng npm |
| `frontend/.env.example` → `frontend/.env.local` | Chạy frontend trực tiếp bằng npm |

- **Không commit file `.env`** (đã có trong `.gitignore`). Secret chia sẻ trong nhóm qua kênh riêng, không gửi lên repo hay Jira.
- Biến `VITE_*` bị nhúng vào JS gửi xuống trình duyệt, chỉ để giá trị public (ví dụ Firebase Web config).
- Thêm biến mới cho backend: khai báo trong `backend/src/config/env.validation.ts`, `configuration.ts` và cả hai file `.env.example`.

---

## 6. Quy ước làm việc

**Nhánh và Pull Request**

- `main` luôn chạy được. Mỗi task một nhánh từ `main`: `feature/UC07-create-booking`, `fix/UC16-checkin-status`, `chore/ci-cache`.
- Mở PR vào `main`, CI phải xanh và có ít nhất 1 người review. Ghi mã task Jira trong tiêu đề PR.
- Rebase hoặc merge `main` thường xuyên để tránh conflict lớn cuối sprint.
- Làm xong nhánh nào thì push và merge ngay nhánh đó vào `main` bằng merge commit, áp dụng cho cả `feature/*` và `fix/*`, khi đủ phạm vi và các kiểm tra bắt buộc đã pass hoặc được miễn rõ ràng. Sau merge, pull `main` mới nhất rồi mới tạo nhánh feature hoặc fix tiếp theo. Nhánh fix cũng phải được tích hợp vào `main`; nếu fix tách từ feature chưa merge, đưa feature vào main trước để giữ đủ phụ thuộc.

**Commit** theo [Conventional Commits](https://www.conventionalcommits.org/): `feat(booking): tạo booking nhiều phòng`, `fix(auth): ...`, `docs: ...`, `test: ...`, `chore: ...`.

**Backend**

- Mỗi nhóm chức năng một module trong `backend/src/modules/` (tạo bằng `npx nest g resource modules/<tên>`).
- Controller chỉ nhận request và gọi service; business rule (BR-xxx) nằm trong service và có unit test.
- DTO dùng class-validator; ValidationPipe đã bật `whitelist` và `forbidNonWhitelisted`.
- API có version: `/api/v1/...`. Lỗi trả về dạng chuẩn `{ statusCode, message, error, path, timestamp }`.
- Endpoint cho Guest gắn `@Public()`, giới hạn role bằng `@Roles(Role.Manager, ...)`.
- Import nội bộ dùng đuôi `.js` vì backend chạy ESM.

**Frontend**

- Code theo feature trong `frontend/src/features/<tên>`; gọi API qua `api` trong `src/lib/api-client.ts` và TanStack Query.
- Import bằng alias `@/` (trỏ tới `src/`).
- Màu, font, khoảng cách luôn dùng token/class Tailwind từ design system, không viết mã hex trong component (xem [`DESIGN.md`](DESIGN.md)).
- Component mới có đủ trạng thái hover, focus, disabled và kiểm tra ở màn hình 375px.

---

## 7. Kế hoạch Sprint 1 và phân công

**Sprint 1: 23/10 – 01/11/2026**, 5 thành viên, 12 epic, 68 task, 207 story point. Chi tiết từng task nằm trên Jira (file import: `phan-cong/jira-import.csv` trong thư mục dự án).

| Đợt | Hạn | Mục tiêu | Priority |
|---|---|---|---|
| Đợt 1 | Thứ Hai 26/10 | Nền tảng và dữ liệu gốc: repo, DB + seed, đăng nhập/RBAC, layout, phòng/loại phòng/dịch vụ, tìm phòng, task core | Highest |
| Đợt 2 | Thứ Tư 28/10 | Đặt phòng và đặt cọc VNPay, booking tại quầy, Service Order, cập nhật task, quản lý tài khoản, email, báo hỏng | High |
| Đợt 3 | Thứ Sáu 30/10 | Check-in/out, hóa đơn cuối, sự cố, phản hồi, phân quyền, báo cáo | Medium |
| Ghép nối | 31/10 – 01/11 | Tích hợp, test tổng, sửa lỗi | — |

### 7.1 Chuỗi phụ thuộc chính

1. Khởi tạo repo → DB + seed → Firebase/RBAC → mọi màn hình theo role. Đây là đường găng, phải xong trước 26/10.
2. Room Type/Room (Lâm) + Search Available Rooms (Hiếu) → Create Booking → Deposit VNPay; cùng logic phòng trống dùng cho Create Booking for Guest và Update Booking (Khoa).
3. Service tính hóa đơn (Hiếu, đợt 1) → Additional Charge → Check Out (Khoa) → Pay Final Invoice (Hiếu) và Submit Feedback.
4. Task core (Vũ, đợt 1) → Assign Service Order Task, Assign Issue Task, Report Equipment Fault, Monitor Task Queues.
5. Create Service Order cần Service (Lâm) và một booking đang ở; seed sẵn booking `CHECKED_IN` mẫu để không phải chờ Check-in.
6. Revenue Report cần dữ liệu thanh toán từ Deposit VNPay.

Trong lúc chờ DB và auth, các bạn dựng giao diện bằng mock data rồi nối API sau. Ai làm được gì ngay, các "hợp đồng" cần chốt sớm và quy trình cho mỗi task: xem [`docs/HUONG-DAN-TRIEN-KHAI.md`](docs/HUONG-DAN-TRIEN-KHAI.md). Phần nền tảng đã xong (đăng nhập, phân quyền, seed) và cách dùng lại: [`docs/TIEN-DO-DUONG.md`](docs/TIEN-DO-DUONG.md).

### 7.2 Tổng quan phân công

| Thành viên | Phụ trách chính | Đợt 1 | Đợt 2 | Đợt 3 | Tổng SP |
|---|---|---|---|---|---|
| **Vũ Ngọc Dương** | Nền tảng (repo, DB, auth/RBAC), Tài khoản & Phân quyền, xem/trả lời phản hồi | 17 | 12 | 12 | 41 |
| **Nguyễn Công Hiếu** | Tìm phòng & Đặt phòng online, Hóa đơn & Thanh toán VNPay | 10 | 16 | 15 | 41 |
| **Nguyễn Đăng Khoa** | Layout chung & routing theo role, Lễ tân (booking tại quầy, check-in/check-out), gửi phản hồi | 10 | 14 | 16 | 40 |
| **Lê Anh Vũ** | Task core cho nhân viên, Đặt dịch vụ (Service Order), Quản lý sự cố | 7 | 16 | 20 | 43 |
| **Trần Bảo Lâm** | Quản lý cơ sở vật chất (phòng, loại phòng, tiện nghi, dịch vụ), Bảo trì, Gmail notification, Báo cáo | 19 | 10 | 13 | 42 |

### Vũ Ngọc Dương

| # | Đợt (hạn) | Task | SP | Cần xong trước |
|---|---|---|---|---|
| 13 | 1 (26/10) | Khởi tạo repo, khung BE/FE, coding convention, CI | 3 | — |
| 14 | 1 (26/10) | Thiết kế DB + migration + seed data (16 entity, có sẵn booking CHECKED_IN mẫu để test) | 5 | #13 (Dương) |
| 15 | 1 (26/10) | Xác thực Firebase + middleware RBAC (BR-INT-01/02, BR-RBAC-03) | 5 | #14 (Dương) |
| 16 | 1 (26/10) | [UC02] Login | 3 | #15 (Dương) |
| 17 | 1 (26/10) | [UC03] Logout | 1 | #16 (Dương) |
| 19 | 2 (28/10) | [UC01] Register Account (xác minh email) | 5 | #15 (Dương) |
| 20 | 2 (28/10) | [UC04] Update Profile | 2 | #15 (Dương) |
| 21 | 2 (28/10) | [UC42] View Account List (Customer/Staff List) | 2 | #15 (Dương) |
| 22 | 2 (28/10) | [UC43] Create / Update Account | 3 | #21 (Dương) |
| 23 | 3 (30/10) | [UC44] View Role List | 1 | #15 (Dương) |
| 24 | 3 (30/10) | [UC46] Create / Update Role | 2 | #23 (Dương) |
| 25 | 3 (30/10) | [UC45] Assign Permissions | 5 | #24 (Dương) |
| 26 | 3 (30/10) | [UC40] View Feedback List | 2 | #63 (Khoa) |
| 27 | 3 (30/10) | [UC41] Reply to Feedback | 2 | #26 (Dương) |

### Nguyễn Công Hiếu

| # | Đợt (hạn) | Task | SP | Cần xong trước |
|---|---|---|---|---|
| 43 | 1 (26/10) | [UC05] Search Available Rooms (logic phòng trống, BR-BOOK-02/04) | 5 | #14 (Dương) |
| 44 | 1 (26/10) | [UC06] View Room Details | 2 | #43 (Hiếu) |
| 45 | 1 (26/10) | Service tính hóa đơn (phòng + dịch vụ + phụ phí, BR-PAY-01) | 3 | #14 (Dương) |
| 46 | 2 (28/10) | [UC07] Create Booking (RoomHold, nhiều phòng) | 8 | #43 (Hiếu), #31 (Lâm) |
| 47 | 2 (28/10) | [UC20] Make Deposit Payment qua VNPay (callback idempotent) | 8 | #46 (Hiếu), #45 (Hiếu) |
| 48 | 3 (30/10) | My Bookings (danh sách booking của Customer) | 2 | #46 (Hiếu) |
| 49 | 3 (30/10) | [UC09] View Booking Detail | 2 | #46 (Hiếu) |
| 50 | 3 (30/10) | [UC12] Cancel Booking (giải phóng phòng) | 3 | #46 (Hiếu) |
| 51 | 3 (30/10) | [UC19] View Invoice Detail | 3 | #45 (Hiếu) |
| 52 | 3 (30/10) | [UC21] Pay Final Invoice qua VNPay | 5 | #47 (Hiếu), #61 (Khoa) |

### Nguyễn Đăng Khoa

| # | Đợt (hạn) | Task | SP | Cần xong trước |
|---|---|---|---|---|
| 18 | 1 (26/10) | Layout chung, routing theo role, Home Page | 3 | #13 (Dương) |
| 53 | 1 (26/10) | Reception Dashboard | 2 | #18 (Khoa) |
| 54 | 1 (26/10) | [UC13] View Room Availability & Status Board | 3 | #14 (Dương) |
| 55 | 1 (26/10) | [UC14] Search Guest Profile | 2 | #14 (Dương) |
| 56 | 2 (28/10) | [UC08] Create Booking for Guest (walk-in), dùng chung logic phòng trống | 5 | #43 (Hiếu) |
| 57 | 2 (28/10) | [UC10] View Booking List | 2 | #14 (Dương) |
| 58 | 2 (28/10) | [UC11] Update Booking (kiểm tra lại phòng trống) | 5 | #57 (Khoa), #43 (Hiếu) |
| 59 | 2 (28/10) | [UC15] View Same-Day Check-In/Out List | 2 | #57 (Khoa) |
| 60 | 3 (30/10) | [UC16] Check In Guest | 5 | #59 (Khoa), #54 (Khoa) |
| 61 | 3 (30/10) | [UC17] Record Checkout Additional Charge | 3 | #60 (Khoa), #45 (Hiếu) |
| 62 | 3 (30/10) | [UC18] Check Out Guest | 5 | #61 (Khoa) |
| 63 | 3 (30/10) | [UC39] Submit Feedback | 3 | #62 (Khoa) |

### Lê Anh Vũ

| # | Đợt (hạn) | Task | SP | Cần xong trước |
|---|---|---|---|---|
| 64 | 1 (26/10) | Task core: entity, vòng đời trạng thái (BR-TASK-03/05) | 2 | #14 (Dương) |
| 65 | 1 (26/10) | Service Staff / Operations Dashboard | 2 | #18 (Khoa) |
| 66 | 1 (26/10) | [UC37] View Assigned Tasks | 3 | #64 (Vũ) |
| 67 | 2 (28/10) | [UC38] Update Task Progress | 3 | #66 (Vũ) |
| 68 | 2 (28/10) | [UC22] Create Service Order (test bằng booking CHECKED_IN trong seed) | 3 | #35 (Lâm) |
| 69 | 2 (28/10) | [UC23] View Service Orders (Customer) | 2 | #68 (Vũ) |
| 70 | 2 (28/10) | [UC24] View Service Order Requests | 2 | #68 (Vũ) |
| 71 | 2 (28/10) | [UC25] Review Service Order Request | 3 | #70 (Vũ) |
| 72 | 2 (28/10) | [UC26] Assign Service Order Task | 3 | #71 (Vũ), #64 (Vũ) |
| 73 | 3 (30/10) | [UC27] View Service History | 2 | #67 (Vũ) |
| 74 | 3 (30/10) | [UC28] Report Issue | 3 | #14 (Dương) |
| 75 | 3 (30/10) | [UC29] View Issue List | 3 | #74 (Vũ) |
| 76 | 3 (30/10) | [UC30] Review Issue Request | 3 | #75 (Vũ) |
| 77 | 3 (30/10) | [UC31] Assign Issue Resolution Task | 3 | #76 (Vũ), #64 (Vũ) |
| 78 | 3 (30/10) | [UC32] Close Issue | 2 | #77 (Vũ), #67 (Vũ) |
| 79 | 3 (30/10) | [UC33] View Issue Detail | 2 | #75 (Vũ) |
| 80 | 3 (30/10) | [UC34] Report Service Issue | 2 | #74 (Vũ), #66 (Vũ) |

### Trần Bảo Lâm

| # | Đợt (hạn) | Task | SP | Cần xong trước |
|---|---|---|---|---|
| 28 | 1 (26/10) | [UC49] View Room Type List | 2 | #14 (Dương) |
| 29 | 1 (26/10) | [UC50] Create / Update Room Type | 3 | #28 (Lâm) |
| 30 | 1 (26/10) | [UC47] View Room List | 2 | #14 (Dương) |
| 31 | 1 (26/10) | [UC48] Create / Update Room | 3 | #30 (Lâm), #29 (Lâm) |
| 32 | 1 (26/10) | [UC51] View Amenity List | 2 | #14 (Dương) |
| 33 | 1 (26/10) | [UC52] Create / Update Amenity | 2 | #32 (Lâm) |
| 34 | 1 (26/10) | [UC53] View Service List | 2 | #14 (Dương) |
| 35 | 1 (26/10) | [UC54] Create / Update Service | 3 | #34 (Lâm) |
| 36 | 2 (28/10) | Gmail notification service (log lỗi + retry, BR-NOTI) | 3 | #13 (Dương) |
| 37 | 2 (28/10) | [UC35] Report Equipment Fault / Damage | 3 | #64 (Vũ) |
| 38 | 2 (28/10) | [UC36] View Maintenance History | 2 | #37 (Lâm) |
| 39 | 2 (28/10) | Manager Dashboard | 2 | #18 (Khoa) |
| 40 | 3 (30/10) | [UC55] Monitor Task Queues | 3 | #64 (Vũ) |
| 41 | 3 (30/10) | [UC56] View Revenue Report | 5 | #47 (Hiếu) |
| 42 | 3 (30/10) | [UC57] View Operational Report (SRS chưa có đặc tả chi tiết) | 5 | #40 (Lâm) |
Cột "Cần xong trước" ghi số thứ tự task (cột `#`) và người làm task đó.

> Task #13 "Khởi tạo repo, khung BE/FE, coding convention, CI" đã có khung trong repo này (NestJS + React + MongoDB + Docker + CI). Phần còn lại của task là chốt coding convention chi tiết với nhóm.

### 7.3 Rủi ro

- Khoảng 41 SP mỗi người trong một tuần là rất dày. Nếu đến tối 28/10 đợt 2 chưa xong, dời UC57 Operational Report, UC45 Assign Permissions và UC36 Maintenance History sang sprint sau.
- Dương giữ đường găng ở đợt 1 (17 SP); cả nhóm nên ưu tiên review PR của đường găng.
- SRS còn thiếu: UC57 chưa có đặc tả, mục 3 và 4 (Functional/Non-functional) còn trống, entity `Equipment` chưa có use case quản lý.

## Thành viên

Tiến độ và hợp đồng bàn giao của Trần Bảo Lâm được cập nhật chung tại [docs/TIEN-DO-LAM.md](docs/TIEN-DO-LAM.md).

Nguyễn Công Hiếu · Vũ Ngọc Dương · Nguyễn Đăng Khoa · Lê Anh Vũ · Trần Bảo Lâm
