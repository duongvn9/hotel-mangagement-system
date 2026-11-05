# Hướng dẫn repolish UI theo prototype

Dành cho **dev và AI (Claude Code, Codex…)** khi làm các task Jira "đưa trang X về UI mới".
Mục tiêu: sau khi migrate, trang trong `frontend/` **giống prototype** về bố cục, màu, chữ, khoảng cách, bo góc, bóng, icon và các
trạng thái (hover, focus, disabled, trống, đang tải, lỗi), trong khi **logic và test hành vi giữ nguyên**.

Đọc trước: [`DESIGN.md`](../DESIGN.md) (token, component, quy tắc) và [`ui-prototype/README.md`](../ui-prototype/README.md).

## 1. Quy trình cho một trang

1. **Tìm màn tương ứng** trong bảng ở mục 3 và mở file đó trong `ui-prototype/src/routes/`. Đọc luôn các component nó import
   (`ui-prototype/src/components/hms/*`).
2. **Chạy prototype để xem** (`cd ui-prototype && bun install && bun run dev`, hoặc mở <https://stayflow-hotel-harmony.lovable.app>).
   Chọn đúng vai trò ở khu `/app`. Chụp màn hình ở 1440px và 375px.
3. **Liệt kê component cần dùng** từ `@/components/atoms | molecules | organisms | templates` (catalog ở `DESIGN.md` mục 7).
   Thiếu component → thêm đúng tầng, **kèm test** (tạo atom/molecule/organism mới theo đúng mã của prototype), không viết trong trang.
4. **Sửa phần trình bày** của trang: thay JSX/class bằng component và token mới. Giữ nguyên hook, gọi API, validate, điều hướng,
   `RequireAuth`, `data-testid`/nhãn mà test đang dùng. Test hành vi hiện có phải vẫn xanh.
5. **Đối chiếu với prototype** theo checklist mục 2 ở 1440px và 375px.
6. **Chạy** (trong `frontend/`): `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`.

## 2. "Giống prototype" nghĩa là gì (checklist cho PR)

- [ ] Cùng cấu trúc: thứ tự khối, lưới, `PageHeader` → nội dung; cùng tầng bọc (`Panel`, `card-soft`, `DataTable`).
- [ ] Cùng token: màu bằng lớp ngữ nghĩa (`bg-card`, `text-muted-foreground`, `bg-ink`…), bo góc, bóng (`shadow-soft/lift`).
- [ ] Cùng chữ: font (sans/`font-display`), cỡ, độ đậm, `tracking`, `uppercase` như prototype.
- [ ] Cùng khoảng cách: `gap/p/mx/max-w-*` như prototype ở desktop và mobile.
- [ ] Cùng icon: lucide **cùng tên**, cùng `size-*`.
- [ ] Đủ trạng thái: hover, focus-visible, disabled, đang tải (`Skeleton`), trống (`EmptyState`), lỗi (`FormField` error).
- [ ] Dữ liệu thật vẫn đẹp với chuỗi dài, danh sách rỗng, số lớn (không vỡ bố cục).
- [ ] Không còn lớp legacy (`pearl-*`, `cream-*`, `stone-*`, `brandy-*`, `*-bg`, `font-body`, `max-w-container`).
- [ ] Không hex/`px` tùy ý; không import `components/ui/` hoặc component cũ (`components/*.tsx`) trong trang này.

## 3. Bảng ánh xạ prototype ↔ app

Cột "Task Jira" để nhóm điền khi nhận task. Đường dẫn app lấy từ `frontend/src/features/*/routes.tsx` và `frontend/src/pages/`.

| Prototype (`ui-prototype/src/routes/`) | Route app | Trang trong app | Task Jira |
|---|---|---|---|
| `index.tsx` | `/` | `pages/HomePage.tsx` | Done |
| `rooms.index.tsx` | `/search` | `features/booking/pages/SearchRoomsPage.tsx` | Done |
| `rooms.$typeId.tsx` | `/room-types/:id` | `features/booking/pages/RoomDetailsPage.tsx` | Done |
| `book.$typeId.tsx` | `/booking/new` | `features/booking/pages/CreateBookingPage.tsx` | Done |
| `lookup.tsx` | `/booking/lookup` | `features/booking/pages/LookupBookingPage.tsx` | Done |
| `payment-return.tsx` | `/payment/vnpay-return` | `features/booking/pages/PaymentReturnPage.tsx` | Done |
| `login.tsx`, `register.tsx` | `/login`, `/register` | `features/auth/pages/LoginPage.tsx`, `RegisterPage.tsx` | Done |
| `unauthorized.tsx` | (trong `RequireAuth`) | `features/auth/RequireAuth.tsx` | Done |
| `app.profile.tsx` | `/profile` | `features/auth/pages/ProfilePage.tsx` | Done |
| `app.my-bookings.tsx` | `/my-bookings` | `features/booking/pages/MyBookingsPage.tsx` | Done |
| `app.bookings.$id.tsx` | `/booking/:id`, `/reception/bookings/:code` | `BookingDetailPage.tsx`, `ReceptionBookingDetailPage.tsx` | Done (khách) |
| `experiences.tsx` | `/experiences` | `features/experiences/pages/ExperiencesPage.tsx` | Done |
| `app.bookings.index.tsx` | `/reception/bookings` | `features/booking/pages/BookingListPage.tsx` | |
| `app.walk-in.tsx` | `/reception/booking/new` | `features/booking/pages/WalkInBookingPage.tsx` | |
| `app.front-desk.tsx` | `/reception/front-desk` | `features/booking/pages/FrontDeskPage.tsx` | |
| `app.guests.tsx` | `/reception/guests` | `features/booking/pages/GuestSearchPage.tsx` | |
| `app.room-board.tsx` | `/reception/rooms` | `features/booking/pages/RoomStatusBoardPage.tsx` | |
| `app.reconciliation.tsx` | `/manager/payments/reconciliation` | `features/booking/pages/ReconciliationPage.tsx` | |
| `app.reception.tsx` | `/reception/dashboard` | `features/dashboard/pages/ReceptionDashboardPage.tsx` | |
| `app.dashboard.tsx` | `/manager/dashboard` | `features/dashboard/pages/ManagerDashboardPage.tsx` | |
| `app.revenue.tsx` | `/manager/reports/revenue` | `features/reports/pages/RevenueReportPage.tsx` | |
| `app.operations-report.tsx` | `/manager/reports/operational` | `features/reports/pages/OperationalReportPage.tsx` | |
| `app.accounts.tsx` | `/manager/accounts` | `features/accounts/pages/AccountsPage.tsx` | |
| `app.roles.tsx` | `/manager/roles` | `features/roles/pages/RolesPage.tsx` | |
| `app.rooms.tsx` | `/manager/rooms` | `features/rooms/pages/RoomsPage.tsx` | |
| `app.room-types.tsx` | `/manager/room-types` | `features/room-types/pages/RoomTypesPage.tsx` | |
| `app.amenities.tsx` | `/manager/amenities` | `features/amenities/pages/AmenitiesPage.tsx` | |
| `app.services.tsx` | `/manager/services` | `features/services/pages/ServicesPage.tsx` | |
| `app.task-queues.tsx` | `/manager/task-queues` (+ `/:taskId`) | `features/task-supervision/pages/TaskQueuesPage.tsx`, `TaskQueueDetailPage.tsx` | |
| `app.tasks.tsx` | `/staff/tasks` (+ `/:id`) | `features/tasks/pages/AssignedTasksPage.tsx`, `AssignedTaskDetailPage.tsx` | |
| `app.service-orders.tsx` | `/staff/service-orders`, `/staff/service-history` | `features/service-orders/pages/StaffServiceOrdersPage.tsx`, `ServiceHistoryPage.tsx` | |
| `app.order-service.tsx` | `/customer/service-orders/new` (+ danh sách `/customer/service-orders`) | `features/service-orders/pages/NewServiceOrderPage.tsx`, `ServiceOrdersPage.tsx` | |
| `app.service-desk.tsx` | `/staff/service/dashboard` | `features/staff-dashboards/StaffDashboardPage.tsx` | |
| `app.operations.tsx` | `/staff/operations/dashboard` | `features/staff-dashboards/StaffDashboardPage.tsx` | |
| `app.issues.tsx` | `/customer/issues`, `/staff/issues`, `/manager/issues` | `features/issues/pages/IssueListPage.tsx`, `IssueDetailPage.tsx` | |
| `app.report-issue.tsx` | `/customer/issues/report`, `/operations/maintenance/report` | `features/issues/pages/ReportIssuePage.tsx`, `features/maintenance/pages/ReportFaultPage.tsx` | |
| `app.maintenance.tsx` | `/operations/maintenance/history` | `features/maintenance/pages/MaintenanceHistoryPage.tsx` | |
| `app.feedback.tsx` | `/my-feedback` | `features/feedback/pages/MyFeedbackPage.tsx` | |
| `app.feedback-review.tsx` | `/staff/feedback` | `features/feedback/pages/FeedbackPage.tsx` | |
| `app.tsx` (khung khu làm việc) | mọi route nhân viên | `layouts/StaffLayout.tsx`, `StaffNav.tsx` → dùng `templates/WorkspaceLayout` | |
| `components/hms/SiteLayout.tsx` | mọi route khách | `layouts/PublicLayout.tsx` → dùng `templates/SiteLayout` | Done |

**Màn prototype chưa có trong app (hỏi Khoa trước, không tự làm):** `experiences.tsx`, `app.home.tsx`, `app.equipment.tsx`.

**Màn đề xuất, không triển khai:** `app.notifications.tsx` và mọi chấm/nhãn "Đề xuất UX" (`Proposed`) trong prototype. Đây là đề
xuất chưa có backend; không đưa nhãn đó vào app.

**Lưu ý khi nối layout:** `NavGroup`/`NavItem` của `templates/WorkspaceLayout` dùng `title` và có `icon` (lucide, lấy đúng icon
trong `ui-prototype/src/lib/nav.ts`), còn `frontend/src/app/navigation.ts` hiện dùng `label` và chưa có icon. Khi migrate khung
nhân viên cần ánh xạ giữa hai dạng và bổ sung icon.

## 4. Cấm

- Hardcode màu (hex/`oklch()`), `px` tùy ý hoặc `style={{…}}` cho thứ có token.
- Tự viết lại Button/Badge/Input/Select/Dialog…; dùng component cũ (`components/*.tsx`) hoặc import `components/ui/*` ở trang đã migrate.
- Sửa `ui-prototype/` (chỉ đọc) hoặc đưa mock data, zustand store, TanStack Router, `RoleSwitcher` từ prototype vào app.
- Đổi hành vi, API, route, quyền hoặc sửa test cho "dễ đẹp". Nếu test hành vi đỏ vì class/đoạn chữ đổi theo prototype, sửa
  assertion tối thiểu và nói rõ trong PR.
- Thêm thư viện mới mà chưa có trong `frontend/package.json` khi component đã có sẵn.

## 5. Khi prototype thiếu hoặc mâu thuẫn

Dừng và hỏi Khoa (nêu màn, trạng thái còn thiếu, đề xuất của bạn). Không tự bịa kiểu hiển thị. Ví dụ: app có trạng thái lỗi hoặc cột
dữ liệu mà prototype không có.

## 6. Quy trình PR

- Nhánh theo task Jira; commit nhỏ, Conventional Commits (`feat(ui): …`, `test(ui): …`), mỗi commit tự build/test được.
- Chỉ `git add` đường dẫn cụ thể (không `git add -A`); không đưa `.env*`, file khóa dịch vụ hay `docker-compose.yml` đang sửa dở vào commit.
- PR có: ảnh **prototype | app** ở 1440px và 375px, checklist mục 2 đã tích, danh sách việc **chưa xem bằng mắt**, kết quả
  `typecheck/lint/format:check/test/build`.

## 7. Prompt mẫu cho AI

Điền `{...}` rồi dán nguyên khối:

```text
Task Jira: {MÃ_TASK} — đưa trang {TÊN_TRANG} về UI mới theo prototype.

Trang app: {ĐƯỜNG_DẪN_FILE_APP} (route {ROUTE_APP})
Màn prototype tương ứng: ui-prototype/src/routes/{FILE_PROTOTYPE}

Làm theo thứ tự:
1. Đọc DESIGN.md và docs/UI-REPOLISH-GUIDE.md, rồi đọc file prototype ở trên cùng mọi component nó import.
2. Đọc trang app hiện tại và test của nó. Liệt kê ngắn gọn (a) hành vi/logic/test phải giữ nguyên, (b) khác biệt giữa app và prototype
   (bố cục, token, chữ, khoảng cách, icon, trạng thái), (c) component cần thêm ở tầng nào nếu thiếu.
3. Viết/sửa test trước cho component mới (nếu có), thấy nó đỏ, rồi cài đặt.
4. Sửa trang chỉ ở phần trình bày, dùng component từ @/components/atoms|molecules|organisms|templates và token của DESIGN.md.
   Không hardcode màu, không import components/ui hay component cũ, không sửa ui-prototype/, không đổi logic/API/route.
5. Tự đối chiếu checklist "giống prototype" (guide mục 2), chạy typecheck, lint, format:check, test, build trong frontend/.
6. Báo cáo: đã đổi gì, checklist mục nào chưa chắc chắn hoặc chưa xem bằng mắt, test nào phải sửa assertion và vì sao.
   Nếu prototype thiếu trạng thái mà app cần, dừng và hỏi, đừng tự bịa.
Commit nhỏ theo Conventional Commits; chỉ git add đường dẫn cụ thể.
```
