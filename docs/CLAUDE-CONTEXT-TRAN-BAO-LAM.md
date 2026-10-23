# Context dự án HMS cho Claude — phần việc Trần Bảo Lâm

> Snapshot đọc từ repository ngày 23/10/2026, HEAD `9a0fb22` (merge PR #14, H6 availability).
> Mục đích: cung cấp context cho Claude phân tích và viết prompt giao Codex thực hiện từng task hoàn chỉnh của Trần Bảo Lâm, kế thừa đúng code của nhóm.
> Đây là tài liệu bàn giao, không phải bằng chứng mọi chức năng đã chạy end-to-end. Phiên tạo tài liệu chỉ đọc code và tài liệu, không chạy lại test, ứng dụng hay kết nối Firebase/Gmail/VNPay.


> Cập nhật sau snapshot: xem [bàn giao UC49 của Lâm](TIEN-DO-LAM-UC49.md) cho schema RoomType/Amenity và task #28 đang triển khai. Trạng thái chưa merge và kết quả kiểm thử nằm trong file bàn giao; các mục hiện trạng bên dưới mô tả baseline ban đầu.

> Cập nhật 23/10/2026: UC49 đã merge main tại `4134194`; main khi bắt đầu #29 là `4213c8d`. Xem [bàn giao UC50](TIEN-DO-LAM-UC50.md) cho API tạo/sửa, form và kiểm thử mới; seed Node đang bị chặn bởi import Connection của module Task có sẵn trên main. Các bảng snapshot bên dưới không phải tiến độ hiện tại.

## 1. Cách sử dụng tài liệu

Người dùng là **Trần Bảo Lâm**, thành viên phát triển HMS. Quy trình mong muốn:

1. Claude đọc tài liệu này để hiểu bối cảnh và phần việc của Lâm.
2. Claude chọn một phạm vi hợp lý, phân tích phụ thuộc và viết prompt cụ thể cho Codex.
3. Codex kiểm tra lại repository hiện tại, triển khai, kiểm thử và báo cáo phần đã làm/còn thiếu.
4. Sau mỗi task, cập nhật context theo kết quả thực tế trước khi lên prompt tiếp theo.

Khi Claude không có quyền đọc repo, phải coi đây là snapshot có thời điểm. Không tự khẳng định các task đã merge sau snapshot. Nếu thiếu SRS hoặc hợp đồng, ghi rõ điều chưa biết và yêu cầu Codex kiểm tra nguồn; không tự biến giả định thành business rule đã được nhóm duyệt.

Thứ tự đối chiếu khi có mâu thuẫn:

- Code, test và cấu hình tại revision đang làm cho biết hiện trạng kỹ thuật.
- SRS và quyết định đã xác nhận của nhóm cho biết hành vi nghiệp vụ mong muốn.
- Tài liệu hợp đồng cụ thể và bàn giao mới hơn giải thích các điểm tích hợp.
- README và kế hoạch là nguồn phân công, không tự chứng minh tiến độ.
- Nếu code khác SRS, ghi nhận sai lệch để xử lý; không mặc định code là nghiệp vụ đúng.

## 2. Sản phẩm và nghiệp vụ

**Grand Emily HMS — Hotel Management System** là hệ thống quản lý khách sạn trên web.

| Actor | Nghiệp vụ chính |
|---|---|
| Guest | Tìm phòng, xem phòng, đặt phòng online, đặt cọc, đăng ký |
| Customer | Hồ sơ, booking của mình, thanh toán, đặt dịch vụ, báo sự cố, phản hồi |
| Receptionist | Booking tại quầy, check-in/out, sơ đồ phòng, phụ phí, hóa đơn, duyệt yêu cầu và phản hồi |
| Service Staff | Nhận và cập nhật task dịch vụ, báo sự cố |
| Operations Staff | Task vận hành/bảo trì, báo hỏng thiết bị, lịch sử bảo trì |
| Manager | Tài khoản, phân quyền, cơ sở vật chất, giám sát và báo cáo |

Tổng kế hoạch có 57 use case và 16 entity: `User`, `Role`, `Permission`, `RoomType`, `Room`, `Amenity`, `Booking`, `RoomHold`, `Service`, `ServiceOrder`, `Equipment`, `Issue`, `Task`, `Invoice`, `PaymentTransaction`, `Feedback`.

Tích hợp dự kiến: Firebase Authentication, VNPay và Gmail. Có cấu hình hoặc schema không có nghĩa luồng tích hợp đã hoàn tất.

## 3. Nguồn tài liệu cần kế thừa

| File | Vai trò |
|---|---|
| [README.md](../README.md) | Sản phẩm, stack, cách chạy, convention, toàn bộ phân công và phụ thuộc |
| [DESIGN.md](../DESIGN.md) | Quy chuẩn UI, token, typography, component, responsive và accessibility |
| [HUONG-DAN-TRIEN-KHAI.md](HUONG-DAN-TRIEN-KHAI.md) | Quy trình task, hợp đồng H1–H10, quyền sở hữu schema |
| [TIEN-DO-DUONG.md](TIEN-DO-DUONG.md) | Bàn giao auth/RBAC, users, roles, feedback và cách tái sử dụng |
| [H6-AVAILABILITY.md](H6-AVAILABILITY.md) | Hợp đồng availability mới hơn, cách nối H3, giới hạn concurrency |
| [Frontend features README](../frontend/src/features/README.md) | Tổ chức feature frontend |
| [Backend modules README](../backend/src/modules/README.md) | Convention module, guard và seed |

README nhắc SRS “SRS - HMS” và `phan-cong/jira-import.csv`, nhưng không tìm thấy file SRS/PDF/DOCX hoặc CSV phân công trong cây file đã kiểm tra. Không tuyên bố đã đọc SRS hoặc Jira. Mã `#28`… là số task trong README, không tự suy ra là mã Jira hoặc số GitHub issue.

## 4. Stack và cấu trúc

- Runtime: Node.js 24, npm 11; mỗi thư mục frontend/backend có package riêng.
- Frontend: React 19, TypeScript, Vite 8, React Router 8, TanStack Query 5, Axios, Firebase Web SDK, Tailwind CSS 4.
- Backend: NestJS 12, TypeScript ESM, Mongoose 9, class-validator, Joi, Swagger, Helmet, Terminus.
- Database: MongoDB 8.
- Kiểm tra: Vitest, Testing Library, Supertest, Oxlint, Prettier.
- Hạ tầng: Docker Compose dev/prod, nginx production, GitHub Actions CI.

```text
backend/
  src/
    main.ts                    # Bootstrap API và Swagger
    app.module.ts              # Đăng ký module, validation/filter toàn cục
    config/                    # ConfigService, Joi validation
    common/
      auth/                    # AuthUser, middleware dev
      constants/               # Role, BookingStatus
      database/conventions.ts  # Tiền và ngày nghiệp vụ
      decorators/              # Public, Roles, Permissions, CurrentUser
      filters/                 # Chuẩn hóa lỗi
    database/seed.ts            # Registry seed theo thứ tự phụ thuộc
    modules/                   # Module nghiệp vụ
  test/                        # Integration/e2e cần MongoDB
frontend/
  src/
    app/                       # App, router, query client
    features/                  # auth, accounts, roles, feedback
    components/                # UI dùng chung
    layouts/PublicLayout.tsx   # Layout đang được router sử dụng
    pages/                     # HomePage, NotFoundPage
    lib/                       # Axios, env, Firebase
    styles/index.css           # Import token và Tailwind
design-system/
  tokens.css                   # Nguồn token CSS
  tokens.json
  tailwind.preset.js
  preview.html                 # Preview bộ UI, không phải ứng dụng nghiệp vụ
docs/
.github/workflows/ci.yml
docker-compose.yml
docker-compose.prod.yml
```

## 5. Hiện trạng đã đối chiếu với code

| Nhóm | Đang có | Giới hạn cần hiểu |
|---|---|---|
| Auth | Firebase auth, guard toàn cục, dev auth, login/logout/register/profile FE và BE | Cần env và tài khoản phù hợp khi kiểm tra Firebase thật |
| Accounts | API users, màn danh sách và tạo/sửa tài khoản | Kế thừa, không viết auth/users mới |
| Roles | API role/permission và UI quản trị | Mã role dạng chuỗi; có role tùy chỉnh theo permission |
| Feedback | API danh sách/chi tiết/trả lời, UI staff | Chưa có UC39 gửi feedback; seed vẫn tham chiếu booking ID cố định |
| Booking H5 | Schema Booking, RoomHold, seed booking | Chưa có controller/flow tạo booking online hoàn chỉnh |
| Availability H6 | Core, service, adapter interface, unit/e2e | Nguồn Room thật chưa cấu hình; chưa có public search API/UI |
| Invoice H7 | Schema, calculator, InvoicesService, adapter, unit/e2e | Pricing adapter mặc định báo unavailable; chưa có controller/UI hóa đơn hoàn chỉnh |
| Payments | Module và PaymentTransaction schema | Chưa có tích hợp VNPay/callback hoàn chỉnh |
| Layout H10 | Router gộp feature dưới PublicLayout, UserMenu theo role | Chưa có bộ layout riêng Public/Customer/Receptionist/Staff/Manager |
| Cơ sở vật chất của Lâm | Chưa có module/schema/feature tương ứng | H3/H4 là ưu tiên nền tảng |
| Task/ServiceOrder/Issue | Chưa có module trong snapshot | H8 của Vũ chưa có để tích hợp thật |
| Notifications, maintenance, reports | Chưa có module/feature trong snapshot | Thuộc phần việc tiếp theo của Lâm |

Các test hiện diện không đồng nghĩa phiên này đã chạy và xác nhận chúng pass. Số test trong tài liệu H6 là báo cáo lịch sử của tác giả, không phải kết quả kiểm tra mới.

### Các điểm tài liệu cũ cần hiệu chỉnh trong suy luận

- Hướng dẫn triển khai còn ghi H3–H10 chưa merge; thực tế Git history/code đã có H5 (PR #12), H7 (PR #13), H6 (PR #14).
- Tài liệu Dương còn nói đang chờ schema Booking; schema và seed Booking nay đã có.
- Registry seed hiện là `roles → users → bookings → feedback`.
- `seedBookings` tìm trực tiếp một Room active trong collection `rooms`; nếu chưa có thì bỏ qua. Vì vậy có code seed chưa đảm bảo có booking CHECKED_IN mẫu.
- `feedback/seed.ts` vẫn có TODO dùng booking thật, chưa tự nối sang booking vừa seed.
- DESIGN liệt kê thêm RESERVED/OUT_OF_SERVICE cho hiển thị; H3 kế hoạch chỉ chốt AVAILABLE/OCCUPIED/CLEANING/MAINTENANCE. Không tự coi toàn bộ bảng UI là enum nghiệp vụ đã chốt.

## 6. Kế thừa công việc của từng thành viên

### 6.1 Vũ Ngọc Dương — nền tảng, auth/RBAC, accounts, roles, feedback

Theo bàn giao, Dương đã hoàn thành H1/H2, khung repo và UC01–04, UC40–46. Phần seed tổng đã có, nhưng dữ liệu phòng/booking còn phụ thuộc module sở hữu.

Phải dùng lại:

- `common/constants/role.enum.ts`: CUSTOMER, RECEPTIONIST, SERVICE_STAFF, OPERATIONS_STAFF, MANAGER.
- `User.role` là mã chuỗi, không phải ObjectId; không đổi cấu trúc này. Không cho sửa `Role.code`.
- `AuthGuard`, `RolesGuard` toàn cục qua AuthModule; không tự thêm hệ xác thực khác.
- `@CurrentUser()` lấy `AuthUser { id, email, role }`.
- Mặc định endpoint cần đăng nhập. Guest endpoint cần `@Public()`.
- `@Roles(...)` và `@Permissions(...)`: cho qua khi role khớp HOẶC role có đủ permission được khai báo, không phải bắt buộc đồng thời cả hai.
- Permission sẵn có liên quan Lâm: `facility:manage`, `report:view`, `issue:report`, `issue:manage`, `task:execute`. Chọn theo actor và nghiệp vụ; không gán permission tùy tiện chỉ để qua guard.
- Frontend `useAuth()`, `RequireAuth`, Axios chung và component chung.
- Seed idempotent bằng `$setOnInsert` + upsert, giữ dữ liệu người dùng đã sửa.

API hiện có, prefix `/api/v1`:

| API | Mục đích |
|---|---|
| GET `/auth/me` | Thông tin user và permissions |
| POST `/auth/register` | Tạo Customer từ Firebase token |
| GET `/auth/dev-accounts` | Tài khoản giả lập, chỉ dev |
| PATCH `/users/me` | Sửa hồ sơ |
| GET/POST `/users`, GET/PATCH `/users/:id` | Quản lý tài khoản |
| GET/POST `/roles`, GET/PATCH `/roles/:id` | Quản lý vai trò |
| GET `/permissions`, PUT `/roles/:id/permissions` | Danh sách/gán quyền |
| GET `/feedback`, GET `/feedback/:id`, POST `/feedback/:id/reply` | Xem/trả lời phản hồi |

Xem DTO/controller hiện tại để lấy payload chính xác khi thực hiện task. Không ghi secret Firebase/service account vào prompt, mã nguồn hoặc tài liệu.

### 6.2 Nguyễn Công Hiếu — booking, availability, hóa đơn và thanh toán

Code đã kế thừa được:

- `bookings/schemas/booking.schema.ts`: code unique, customer tùy chọn, thông tin guest, mảng `rooms` ObjectId không trùng/rỗng, checkIn/checkOut, guests, status, roomTotal, depositAmount, các mốc check-in/out/cancel, isActive.
- `common/constants/booking-status.enum.ts`: PENDING_DEPOSIT, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED. Dùng enum sẵn có, không tạo bản sao.
- `room-hold.schema.ts`: booking unique, rooms, checkIn/checkOut, expiresAt, isActive; TTL trên expiresAt. TTL không phải cơ chế khóa chống double booking.
- PaymentTransaction: booking, invoice, transactionRef unique, providerTransactionRef, method VNPAY/CASH, purpose DEPOSIT/FINAL, status PENDING/SUCCESS/FAILED/CANCELLED, amount, paidAt, isActive.
- Invoice: breakdown phòng/dịch vụ/phụ phí/giảm giá/thuế, totalAmount, depositPaid/finalPaid/balanceDue, status, charges; unique theo booking và optimistic concurrency.

**H6 — điểm nối H3 của Lâm**

`BookingsModule` export `AvailabilityService`, `AvailabilityRoomSource`, `AvailabilityClock`.

```ts
AvailabilityService.findAvailableRooms({ checkIn, checkOut, guests, roomTypeId? })
// Promise<AvailableRoom[]>; hiện gồm id, roomTypeId, capacity
```

`AvailabilityRoomSource.findCandidates(query)` là abstraction cần nối Room/RoomType thật. Provider hiện dùng `UnconfiguredAvailabilityRoomSource`, ném 503. Không được thay bằng danh sách rỗng để che lỗi cấu hình hoặc trả phòng mock trong production.

Adapter thật phải trả physical rooms với các field: `id`, `roomTypeId`, `capacity`, `isActive`, `roomTypeActive`, `operationallyAvailable`. ID là ObjectId canonical lowercase; thiếu RoomType hoặc inactive phải bị loại.

Quy tắc phải giữ:

- Khoảng ngày nửa mở `[checkIn, checkOut)`; checkout hôm trước có thể bằng checkin lượt sau.
- Ngày lịch `YYYY-MM-DD` hoặc Date instant; xử lý ngày nghiệp vụ theo Asia/Ho_Chi_Minh, không tự query raw UTC midnight.
- H6 hiện tìm từng phòng đủ capacity cho guests, không tìm tổ hợp nhiều phòng.
- Chỉ trạng thái cho phép mới được nhận. Khi chỉ có trạng thái hiện tại, OCCUPIED/CLEANING/MAINTENANCE/unknown bị loại bảo thủ ở mọi khoảng, không đoán ngày tương lai.
- CONFIRMED/CHECKED_IN active và hold chưa hết hạn chặn phòng theo logic H6. Không nhân bản thuật toán này trong RoomsService hoặc frontend.
- Search là snapshot read-only, không bảo đảm thao tác booking sau đó thành công; concurrency booking thuộc task #46 của Hiếu.
- Task H3 thuần schema không mặc định phải hoàn thành toàn bộ UC05. Nếu nối adapter H6 trong cùng task, ghi rõ phạm vi và có integration test phòng thật.

Đọc trọn [H6-AVAILABILITY.md](H6-AVAILABILITY.md) và `availability.core.ts` trước khi nối adapter.

**H7 — điểm nối giá và phí**

```ts
InvoicesService.getOrCreateForBooking(bookingId)
InvoicesService.addCharge({ bookingId, type, amount, reason, sourceId? })
InvoicesService.recalculate(bookingId)
```

- `InvoicePricingAdapter.getRoomLines(booking)` trả `{ roomId, rate, units }[]` cho đúng toàn bộ phòng booking.
- Provider mặc định là `UnavailableInvoicePricingAdapter`: chưa có nguồn giá authoritative.
- Không tự lấy giá RoomType hiện tại để tính lại booking cũ rồi gọi đó là snapshot giá đã chốt. Cần thống nhất nơi lưu snapshot/nguồn giá với Hiếu.
- `InvoiceChargesAdapter` mặc định đọc invoice.charges; dữ liệu legacy có tổng phí nhưng không có nguồn charge sẽ báo unavailable.
- `sourceId` hỗ trợ chống ghi phí trùng và phát hiện nội dung mâu thuẫn. Không ghi trực tiếp tổng invoice từ module khác.
- Báo cáo doanh thu của Lâm phải phân biệt invoice với tiền thực thu. SUCCESS/paidAt/isActive là dữ liệu cần xem xét; định nghĩa KPI, refund và kỳ báo cáo cần chốt theo yêu cầu, không suy ra mọi invoice đều là doanh thu đã thu.

### 6.3 Nguyễn Đăng Khoa — layout, lễ tân và gửi feedback

Theo phân công: #18/H10 layout/routing, Reception Dashboard, Room Status Board, booking tại quầy, check-in/out, phụ phí, UC39 gửi feedback.

Snapshot chưa có layout riêng theo role. `frontend/src/app/router.tsx` gộp auth/account/role/feedback dưới PublicLayout. Menu tạm nằm ở `features/auth/UserMenu.tsx`.

- Lâm tạo `routes.tsx` của feature để Khoa ghép layout, tránh tự viết lại hệ layout toàn ứng dụng trong task CRUD.
- Chọn route `/manager/...` cho trang quản trị là đề xuất phù hợp convention hiện có, chưa phải hợp đồng H10 đầy đủ.
- RoomStatus/Room schema của Lâm là nguồn dùng chung cho sơ đồ phòng và check-in/out của Khoa. Không tự tạo enum tương tự ở nhiều module.
- UC39 chưa triển khai; không lẫn với UC40/41 của Dương.

### 6.4 Lê Anh Vũ — Task, ServiceOrder và Issue

Theo kế hoạch Vũ sở hữu `Task`, `ServiceOrder`, `Issue`; snapshot chưa có module/schema tương ứng.

H8 dự kiến: TaskStatus ASSIGNED/IN_PROGRESS/COMPLETED và `TasksService.create({ sourceType, sourceId, assigneeId, ... })`. Dấu `...` là hợp đồng chưa đủ chi tiết; phải kiểm tra/chốt chữ ký thật trước tích hợp.

- H4 Service của Lâm mở đường cho ServiceOrder của Vũ.
- UC35 báo hỏng thiết bị của Lâm cần Task core của Vũ; không xây hệ Task thứ hai để né phụ thuộc.
- UC55/57 cần dữ liệu Task; có thể viết UI/test fixture khi chờ, nhưng phải ghi rõ chưa tích hợp thật.
- Phí dịch vụ sẽ nối H7 của Hiếu. Schema Service phải làm rõ giá/đơn vị và active để tránh mỗi nơi tính phí khác nhau.

## 7. Toàn bộ công việc của Trần Bảo Lâm

Sprint 1: **23/10–01/11/2026**, tổng **42 SP**, gồm cả backend/frontend tùy task; Gmail là service backend.

| Task | UC / Nội dung | Hạn | SP | Phụ thuộc trong README |
|---|---|---|---|---|
| #28 | UC49 View Room Type List | 26/10 | 2 | #14 Dương |
| #29 | UC50 Create/Update Room Type | 26/10 | 3 | #28 |
| #30 | UC47 View Room List | 26/10 | 2 | #14 Dương |
| #31 | UC48 Create/Update Room | 26/10 | 3 | #30, #29 |
| #32 | UC51 View Amenity List | 26/10 | 2 | #14 Dương |
| #33 | UC52 Create/Update Amenity | 26/10 | 2 | #32 |
| #34 | UC53 View Service List | 26/10 | 2 | #14 Dương |
| #35 | UC54 Create/Update Service | 26/10 | 3 | #34 |
| #36 | Gmail notification, log lỗi + retry, BR-NOTI | 28/10 | 3 | #13 Dương |
| #37 | UC35 Report Equipment Fault/Damage | 28/10 | 3 | #64 Vũ |
| #38 | UC36 View Maintenance History | 28/10 | 2 | #37 |
| #39 | Manager Dashboard | 28/10 | 2 | #18 Khoa |
| #40 | UC55 Monitor Task Queues | 30/10 | 3 | #64 Vũ |
| #41 | UC56 View Revenue Report | 30/10 | 5 | #47 Hiếu, đặt cọc VNPay |
| #42 | UC57 View Operational Report | 30/10 | 5 | #40 |

Lâm tự sở hữu schema/seed của `RoomType`, `Room`, `Amenity`, `Service`, `Equipment`; không cần chờ Dương viết giúp các schema này.

Hợp đồng Lâm phải bàn giao:

| Hợp đồng | Nội dung | Người dùng | Hạn kế hoạch |
|---|---|---|---|
| H3 | RoomType, Room, RoomStatus | Hiếu, Khoa | 23/10 |
| H4 | Service: giá, đơn vị, isActive | Vũ, Hiếu | 23/10 |
| H9 | NotificationsService.send({ to, template, data }) | Hiếu, Khoa | 24/10 |

## 8. Lộ trình đề xuất để Claude chia prompt

Đây là đề xuất triển khai, không thay thế phân công gốc.

1. **Prompt nền tảng H3/H4:** kiểm tra thay đổi mới; thiết kế schema, enum, module export, seed idempotent, đăng ký AppModule và SEEDS; test các ràng buộc quan trọng; bàn giao hợp đồng cho người dùng liên quan.
2. **Prompt nối H3–H6:** adapter Room/RoomType thật, Nest DI, integration test availability với dữ liệu phòng thật. Tách khỏi schema nếu phạm vi quá lớn. Không tự mở rộng thành CreateBooking/VNPay.
3. **Prompt CRUD loại phòng #28–29:** BE + FE, phân quyền, validation, list/filter/pagination theo yêu cầu, form, trạng thái tải/rỗng/lỗi/lưu.
4. **Prompt CRUD phòng #30–31:** kế thừa RoomType/RoomStatus, kiểm tra tham chiếu và ràng buộc số phòng theo hợp đồng đã chốt; không phá booking đang tham chiếu.
5. **Prompt CRUD tiện nghi #32–33 và dịch vụ #34–35:** chia theo feature; tái sử dụng UI/API convention; xác định quan hệ tiện nghi và đơn vị dịch vụ từ đặc tả.
6. **Prompt H9/#36:** service gửi mail có transport/config, template, lỗi/retry có giới hạn và test mock transport. Không gửi email thật khi chưa có yêu cầu/đích gửi phù hợp.
7. **Prompt #39:** Manager Dashboard kế thừa H10 nếu đã có, chỉ dùng KPI được định nghĩa; fixture phải có nhãn trạng thái tích hợp rõ ràng trong bàn giao.
8. **Prompt #37–38:** Equipment và báo hỏng/lịch sử, nối Task H8 thật khi đã có.
9. **Prompt #40–42:** queues, doanh thu, vận hành; tách từng UC và chốt định nghĩa báo cáo trước khi tính toán.

SRS hiện thiếu đặc tả UC57 và use case quản lý Equipment. Không tự mở rộng thành CRUD Equipment đầy đủ hoặc báo cáo phức tạp mà không xác định scope. Kế hoạch gốc cho phép cân nhắc dời UC57/UC36 nếu trễ, nhưng đó là quyết định của nhóm, không tự đánh dấu bỏ task.

## 9. Quy chuẩn backend cho mọi task

- Module theo `backend/src/modules/<feature>/`; controller nhận request, service chứa business rule.
- Import nội bộ có đuôi `.js` vì backend ESM.
- API prefix `/api/v1`; Swagger `/api/docs`.
- DTO dùng class-validator; ValidationPipe đã bật whitelist + forbidNonWhitelisted + transform. Field không khai báo bị từ chối.
- Lỗi chuẩn `{ statusCode, message, error, path, timestamp }`.
- `@Schema({ timestamps: true })`; collection số nhiều, soft delete bằng `isActive`.
- Tiền là số nguyên VND, dùng helper `isMoneyVnd`; không dùng float tiền tệ.
- Lưu instant UTC, xử lý ngày nghiệp vụ theo Asia/Ho_Chi_Minh qua quy ước chung; không tự áp giờ máy.
- Ref dùng `Types.ObjectId` và tên model nhất quán với schema hiện có.
- Đọc env bằng ConfigService; biến mới cập nhật configuration, Joi và file env example phù hợp. Không commit env thật.
- Thêm module vào AppModule, export provider/model cần cho module khác.
- Seed thêm vào SEEDS theo phụ thuộc. Khi có phòng, đặt seed rooms trước bookings. Không ghi đè dữ liệu đã chỉnh khi seed lại.
- Unit test business rule; e2e API/DB cho đường tích hợp quan trọng, auth và dữ liệu thật. Không xóa collection module khác hoặc dùng DB dev cho test phá dữ liệu.

Không tự quyết định các rule chưa có nguồn như: hạn chế đổi giá khi có booking, xóa cứng, quy tắc đổi trạng thái, giá bằng 0, unique name không phân biệt hoa thường. Cần đọc đặc tả/code và ghi rõ giả định hợp lý nếu vẫn thiếu.

## 10. Quy chuẩn frontend chi tiết

```text
features/<feature>/
  api.ts             # DTO/type FE và hàm API
  hooks.ts           # Có thể tách query/mutation khi hữu ích
  components/        # UI riêng của feature
  pages/
  routes.tsx         # export RouteObject[]
```

- Import alias `@/` trỏ `src/`.
- `api` từ `@/lib/api-client` đã có baseURL, timeout, token Firebase hoặc header dev; không tạo Axios/auth client riêng.
- TanStack Query quản lý server state; invalidate query phù hợp sau mutation. Existing AccountsPage hiện đặt hooks ngay trong page, vì vậy `hooks.ts` là cấu trúc hướng dẫn, không bắt buộc tách máy móc.
- `getErrorMessage(error)` lấy thông báo backend.
- `useAuth()` trả `me`, `status`, `logout`; me có id/email/fullName/phone/role/permissions.
- `RequireAuth` nhận roles/permissions, cùng cơ chế OR như backend. Guard frontend không thay cho guard backend.
- Tham khảo `features/accounts/routes.tsx`, `api.ts`, `AccountForm.tsx`, `pages/AccountsPage.tsx` và test cùng feature.
- Component chung thực tế: Button (primary/secondary/ghost/danger, loading), TextField, SelectField, Alert, Badge, ApiStatus. Chưa có sẵn mọi Modal/Table được nhắc trong hướng dẫn; kiểm tra trước khi dùng.
- Thể hiện loading, error/retry, empty, validation error, mutation pending và success; tránh bấm lưu nhiều lần.
- Có search/filter/pagination nếu scope/API yêu cầu; giữ query/filter nhất quán sau mutation.
- Test auth bằng `features/auth/test-utils.tsx`, `renderWithAuth`.
- Mock chỉ ở API/fixture với kiểu thống nhất, env bật rõ và TODO task; không mặc định thành dữ liệu production.

### Design system phải giữ

- Nguồn token: `design-system/tokens.css`, `tokens.json`, `tailwind.preset.js`.
- `frontend/src/styles/index.css` đã import token + Tailwind; tailwind.config.js dùng preset chung.
- Nền kem, bề mặt trắng, chữ nâu đen, primary brandy, accent vàng đồng. Không hardcode mã hex trong component.
- Be Vietnam Pro cho UI/form/bảng; Cormorant Garamond cho tiêu đề lớn từ 24px.
- Trang quản trị gọn, ưu tiên dữ liệu. Layout đích: sidebar 264px, topbar 64px, content padding 24–32px; layout hiện tại chưa triển khai đầy đủ.
- Bảng: header rõ, số/tiền căn phải, trạng thái có Badge, toolbar tìm/lọc/thêm mới.
- Form có label, error liên kết aria-describedby, trạng thái disabled/loading.
- Một H1/màn hình; tiền theo vi-VN, ngày hiển thị dd/MM/yyyy.
- Mobile 375px, vùng chạm tối thiểu 44px; hover/focus/disabled rõ; trạng thái có chữ, không chỉ dùng màu.
- Nếu tạo modal: quản lý focus và Esc. Tôn trọng reduced motion.
- Lucide là bộ icon được DESIGN đề xuất, nhưng chưa có dependency Lucide trong frontend/package.json tại snapshot; không mặc định import được.
- Token mới/đổi token phải cập nhật đồng bộ CSS/JSON/preset và DESIGN.md.

## 11. Chạy và kiểm tra

Dev Docker từ gốc repo:

```sh
docker compose up --build --watch
docker compose exec backend npm run seed
```

Các địa chỉ mặc định:

- Frontend: http://localhost:5173
- Health: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/api/docs
- Mongo Docker: localhost:27017, cấu hình thực tế xem compose/env example.

Chạy npm trực tiếp cần MongoDB và env theo README; không tự ghi đè env người dùng. Chưa cấu hình Firebase có thể dùng login dev; backend nhận `x-dev-role` và `x-dev-user-id` khi không production. Danh sách tài khoản mẫu gồm manager/receptionist/customer/service/operations `@hms.local`. Không bỏ middleware dev vì cả nhóm đang dùng.

Kiểm tra trong từng thư mục:

```sh
# backend/
npm run lint
npm run format:check
npm run typecheck
npm test
npm run test:e2e
npm run build

# frontend/
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Backend e2e cần MongoDB và DB test riêng. CI hiện chạy lint/format/typecheck/unit/e2e/build backend; frontend lint/format/test/build; rồi build Docker production. Chỉ báo check đã chạy thật; nếu thiếu runtime/DB thì ghi rõ check chưa chạy và lý do.

## 12. Định nghĩa hoàn thành một task

- Scope và nghiệp vụ của task được xác định, các giả định còn thiếu được ghi rõ.
- Kế thừa schema/enum/service/UI hiện có; không tạo hệ thống trùng.
- Module/provider/seed/route được đăng ký đầy đủ nếu task cần.
- Backend có DTO, phân quyền, kiểm tra dữ liệu và lỗi phù hợp.
- Frontend có luồng sử dụng hoàn chỉnh trong phạm vi, xử lý các trạng thái và responsive.
- API thật được nối khi backend tương ứng đã có; stub còn lại phải có TODO và trạng thái chưa hoàn tất rõ ràng.
- Test quan trọng và các check phù hợp đã chạy; không tuyên bố pass khi chưa chạy.
- Có báo cáo file thay đổi, hành vi, kiểm thử, điểm bàn giao và phụ thuộc chưa giải quyết.
- Theo quy trình nhóm, Jira Done còn cần merge, CI xanh, review ít nhất một người, chạy được Docker và Swagger đúng. Code local xong không tự đồng nghĩa Jira Done.

Quy trình thường trực người dùng đã yêu cầu: làm xong nhánh nào thì push và merge ngay nhánh đó vào main bằng merge commit, áp dụng cho cả feature/* và fix/*. Sau merge, pull main mới nhất rồi mới tạo nhánh feature hoặc fix tiếp theo. Fix tách từ feature chưa merge phải giữ thứ tự phụ thuộc: feature vào main trước, rồi tích hợp fix; không dừng ở merge fix về feature. Commit Conventional Commits, PR ghi mã Jira thật khi đã biết. Không cần hỏi lại quyền commit/push/merge khi đủ scope và các check bắt buộc đã pass hoặc được người dùng miễn rõ ràng; nếu chưa đủ điều kiện thì ghi rõ blocker. Không tự sửa Jira.

## 13. Mẫu prompt để Claude giao Codex

Claude nên điền cụ thể từng mục sau thay vì gửi một yêu cầu rộng như “làm phần của Lâm”.

```text
Bạn đang làm repository hotel-mangagement-system cho Trần Bảo Lâm.
Đọc docs/CLAUDE-CONTEXT-TRAN-BAO-LAM.md và các tài liệu/nguồn liên quan,
sau đó kiểm tra code hiện tại vì context là snapshot 23/10/2026.

Task: [H3/H4 hoặc #28 UC49 ...; mã Jira thật nếu có].
Mục tiêu: [hành vi người dùng/API sau khi hoàn thành].
Actor và quyền: [vai trò, permission, public/private].
Phạm vi: [BE/FE/schema/seed/adapter/test/docs cụ thể].
Ngoài phạm vi: [những phần thuộc người khác, tránh scope mở rộng].

Kế thừa bắt buộc:
- [schema/enum/service/component cụ thể và đường dẫn].
- Auth/RBAC, api-client, design token và seed registry hiện có.
- [hợp đồng đầu vào/đầu ra cần giữ].

Yêu cầu nghiệp vụ:
- [trường dữ liệu, validation, filter, pagination, thao tác].
- [trường hợp lỗi, tham chiếu inactive/không tồn tại, trạng thái].
- [nguồn rule: SRS/README/hợp đồng; giả định còn thiếu ghi riêng].

Tích hợp:
- [module/provider exports, thứ tự seed, route/menu].
- [điểm nối H6/H7/H8/H10 nếu thuộc scope].
- Không tạo schema/service trùng hoặc dùng mock che lỗi production.

Frontend nếu có:
- Dùng component chung và token DESIGN.md.
- Loading/error/empty/pending/success, validation, responsive 375px.
- Nối API thật khi đã có.

Tiêu chí nghiệm thu:
1. [Kịch bản thành công cụ thể].
2. [Kịch bản lỗi/phân quyền quan trọng].
3. [Kịch bản giữ tương thích với người dùng hợp đồng].
4. [Kiểm thử và lint/typecheck/build phù hợp].

Hãy triển khai trong workspace, không chỉ đưa kế hoạch.
Trước khi thay đổi, đọc code liên quan và kiểm tra thay đổi đang có của người dùng.
Nếu thiếu SRS/hợp đồng quan trọng, nêu chính xác điểm thiếu; vẫn làm phần độc lập.
Áp dụng quy trình Git thường trực ở mục 12: xong nhánh feature hoặc fix nào thì push và merge nhánh đó vào main khi đủ điều kiện, rồi pull main mới nhất trước khi tạo nhánh tiếp theo. Không tự gửi mail thật hoặc sửa trạng thái Jira khi chưa được yêu cầu.
Kết thúc báo cáo: đã làm gì, file chính, kiểm thử thực chạy,
giả định/giới hạn và hợp đồng bàn giao để cập nhật context cho task sau.
```

## 14. Những câu hỏi cần giải quyết khi tới task tương ứng

- RoomType: tên field chính thức, capacity/giá/ảnh/tiện nghi và quan hệ Amenity là gì? Chưa có schema để xem đó là hợp đồng đã chốt.
- Room: định danh/số phòng/tầng, unique rule, RoomStatus và quyền đổi trạng thái chính thức?
- Service: đơn vị, loại dịch vụ, giá và cách lưu snapshot khi đặt dịch vụ?
- H7 pricing: giá lịch sử lấy từ snapshot nào, ai sở hữu thay đổi schema liên quan?
- H8: chữ ký TasksService, sourceType/sourceId và liên kết Equipment/Issue chính thức?
- H9: template, cấu hình transport, retry/lưu log và semantics khi gửi thất bại?
- H10: route/menu/layout exports nào đã merge ở thời điểm làm task?
- UC56/57: định nghĩa KPI, khoảng thời gian, timezone, doanh thu thực thu hay phát sinh, cách xử lý hoàn tiền và dữ liệu inactive?
- SRS/acceptance criteria đầy đủ đang nằm ở đâu? UC57 và Equipment còn thiếu đặc tả theo kế hoạch.

Không cần hỏi tất cả câu này cùng lúc; chỉ xử lý câu liên quan phạm vi task đang giao.

## 15. Mẫu cập nhật context sau mỗi task

```text
Ngày / commit hoặc PR:
Task / phạm vi:
Đã triển khai:
API / schema / enum / provider / route mới hoặc thay đổi:
Module khác sử dụng như thế nào:
Seed và thứ tự chạy:
Check đã chạy và kết quả:
Mock/TODO/phụ thuộc còn lại:
Giả định nghiệp vụ đã chốt / còn mở:
Task tiếp theo được mở khóa:
```

Mục tiêu cuối cùng là mỗi prompt làm được một phần việc có thể kiểm tra, tích hợp vào công việc của nhóm và bàn giao tiếp; không chỉ tạo các màn hình rời rạc hoặc đánh dấu hoàn thành khi dữ liệu vẫn giả.
