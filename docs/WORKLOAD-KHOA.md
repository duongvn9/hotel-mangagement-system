# Khối lượng công việc Nguyễn Đăng Khoa — Grand Emily HMS

Cập nhật 27/10/2026, sau khi PR #54 được merge vào `main`. Tài liệu này tổng hợp phần việc Sprint 1 của Khoa (12 hạng mục, 40 story point): đã làm gì, ở PR nào, kiểm tra ra sao, còn tồn đọng gì và bàn giao cho người khác ra sao. Số liệu PR lấy từ GitHub và trạng thái task lấy từ Jira tại thời điểm ghi; số test là số ca ghi nhận khi làm từng PR.

## 1. Tóm tắt

| Chỉ số | Giá trị |
|---|---|
| Hạng mục được giao | 12 (UC08, UC10, UC11, UC13, UC14, UC15, UC16, UC17, UC18, UC39, Layout chung + routing theo role + Home Page, Reception Dashboard) |
| Story point | 40 (khớp phân công trong README) |
| Pull request | 12 (#43 đến #54), tất cả đã merge vào `main` ngày 27/10/2026 |
| Commit trong các PR | 73 |
| Dòng code | +12.761 / −272 |
| Test mới | khoảng 263 ca: backend 125 (26 unit, 99 e2e), frontend 138 |
| Bộ test khi tạo PR cuối | backend unit 968/968, frontend 661/661; lint, typecheck, build, prettier sạch |
| Trạng thái Jira | cả 12 task đang ở **In Testing** |

Cách làm chung: mỗi hạng mục được trình bày thiết kế ngắn và chờ duyệt trước khi code, làm theo TDD (viết test, thấy đỏ rồi mới cài đặt), rồi tạo PR vào `main` và chuyển Jira sang In Review. Từ PR #46 trở đi các PR được tách thành nhiều commit nhỏ để dễ review (PR #43 đến #45 là một commit mỗi PR).

## 2. Bảng hạng mục

| # trong README | Jira | Hạng mục | SP | Đợt (hạn) | PR | Commit | Dòng |
|---|---|---|---|---|---|---|---|
| 56 | WDP301-81 | UC08 Create Booking for Guest (walk-in) | 5 | 2 (28/10) | [#43](https://github.com/duongvn9/hotel-mangagement-system/pull/43) | 1 | +731 −3 |
| 57 | WDP301-82 | UC10 View Booking List | 2 | 2 (28/10) | [#44](https://github.com/duongvn9/hotel-mangagement-system/pull/44) | 1 | +783 −3 |
| 58 | WDP301-83 | UC11 Update Booking | 5 | 2 (28/10) | [#45](https://github.com/duongvn9/hotel-mangagement-system/pull/45) | 1 | +1.023 −7 |
| 54 | WDP301-79 | UC13 Room Availability & Status Board | 3 | 1 (26/10) | [#46](https://github.com/duongvn9/hotel-mangagement-system/pull/46) | 6 | +1.332 −2 |
| 55 | WDP301-80 | UC14 Search Guest Profile | 2 | 1 (26/10) | [#47](https://github.com/duongvn9/hotel-mangagement-system/pull/47) | 7 | +821 −7 |
| 59 | WDP301-84 | UC15 Same-Day Check-In/Out List | 2 | 2 (28/10) | [#48](https://github.com/duongvn9/hotel-mangagement-system/pull/48) | 6 | +786 −33 |
| 60 | WDP301-85 | UC16 Check In Guest | 5 | 3 (30/10) | [#49](https://github.com/duongvn9/hotel-mangagement-system/pull/49) | 6 | +1.351 −8 |
| 61 | WDP301-86 | UC17 Record Checkout Additional Charge | 3 | 3 (30/10) | [#50](https://github.com/duongvn9/hotel-mangagement-system/pull/50) | 5 | +880 −2 |
| 62 | WDP301-87 | UC18 Check Out Guest | 5 | 3 (30/10) | [#51](https://github.com/duongvn9/hotel-mangagement-system/pull/51) | 10 | +1.470 −52 |
| 63 | WDP301-88 | UC39 Submit Feedback | 3 | 3 (30/10) | [#52](https://github.com/duongvn9/hotel-mangagement-system/pull/52) | 7 | +936 −15 |
| 18 | WDP301-43 | Layout chung, routing theo role, Home Page | 3 | 1 (26/10) | [#53](https://github.com/duongvn9/hotel-mangagement-system/pull/53) | 16 | +1.572 −128 |
| 53 | WDP301-78 | Reception Dashboard | 2 | 1 (26/10) | [#54](https://github.com/duongvn9/hotel-mangagement-system/pull/54) | 7 | +1.076 −12 |

Về tiến độ: bốn hạng mục đợt 1 (UC13, UC14, Layout, Reception Dashboard; hạn 26/10) được merge ngày 27/10, tức **trễ một ngày** so với hạn trong kế hoạch. Sáu hạng mục đợt 2 và đợt 3 còn lại được merge sớm hơn hạn (28/10 và 30/10). Nguyên nhân thứ tự: theo Jira, UC15 phải xong trước UC16, UC17 trước UC18, UC18 trước UC39, và Layout phải xong trước Reception Dashboard.

## 3. Chi tiết từng hạng mục

Mọi endpoint nằm dưới tiền tố `/api/v1`. "Lễ tân" nghĩa là role `RECEPTIONIST` và `MANAGER` đều được gọi, trừ khi ghi khác.

### UC08 Create Booking for Guest (walk-in) — PR #43
- `POST /bookings/walk-in`: booking tạo tại quầy vào thẳng `CONFIRMED`, không đặt cọc VNPay và không có `RoomHold` 15 phút, phòng bị chiếm ngay. Không gắn `customer`, lưu thêm `createdBy` (lễ tân tạo).
- Dùng lại bước tính giá và kiểm tra phòng trống của luồng đặt online; hai lễ tân đặt trùng phòng cùng lúc thì booking tạo trước thắng, booking sau bị xoá và trả 409.
- Giao diện: `/reception/booking/new` (tìm phòng trống, chọn phòng, nhập thông tin khách).
- Test: backend e2e 6, frontend 4.

### UC10 View Booking List — PR #44
- `GET /bookings`: lọc theo `status`, từ khoá `q` (mã booking, tên, email, số điện thoại; tìm nguyên văn, không phải regex), khoảng ngày nhận phòng theo giờ Việt Nam (gồm cả hai đầu); phân trang mặc định 20, tối đa 100; mỗi dòng có số phòng, loại phòng và cờ `walkIn`.
- Giao diện: `/reception/bookings`; đọc sẵn `q` từ URL.
- Test: backend e2e 7, frontend 5.

### UC11 Update Booking — PR #45
- `PATCH /bookings/:id`: mọi trường tuỳ chọn (phòng, ngày, số khách, liên hệ); chỉ sửa được booking `PENDING_DEPOSIT` và `CONFIRMED`.
- Đổi phòng, ngày hoặc số khách thì tính lại giá và kiểm tra lại phòng trống **bỏ qua chính booking này**. Booking chờ cọc cập nhật cả `RoomHold` và tiền cọc (30%); booking đã xác nhận giữ nguyên tiền cọc. Thua race thì hoàn tác về dữ liệu cũ và trả 409.
- Giao diện: `/reception/bookings/:code/edit`, nút "Sửa" ở danh sách booking.
- Test: backend e2e 9, frontend 7.

### UC13 Room Availability & Status Board — PR #46
- `GET /room-status-board?date=&floor=&roomTypeId=`: trạng thái từng phòng theo ngày. Mức chiếm theo ưu tiên: đang ở > đã đặt > giữ chỗ > trống; một booking chiếm ngày D khi nhận phòng ≤ D < trả phòng, hold hết hạn thì tính trống. Trạng thái vật lý: bảo trì luôn hiện, "có khách"/"đang dọn" chỉ hiện khi xem hôm nay.
- Logic tính nằm ở hàm thuần `room-status-board.core.ts` (có unit test); controller đặt trong module `bookings` vì `RoomsController` khoá cả class cho Manager.
- Giao diện: `/reception/rooms`, nhóm theo tầng, lọc tầng và loại phòng.
- Test: backend unit 8 và e2e 7, frontend 5.

### UC14 Search Guest Profile — PR #47
- `GET /guests?q=`: hồ sơ khách **gộp từ booking** theo email viết thường (khách walk-in và Guest không có tài khoản chỉ tồn tại dưới dạng thông tin liên hệ trong booking). Mỗi hồ sơ có tên và số điện thoại mới nhất, có tài khoản hay không, số booking, số lần đã trả phòng, ngày nhận phòng gần nhất (không tính booking huỷ). `q` tối thiểu 2 ký tự.
- Giao diện: `/reception/guests`; mỗi khách có hai nút "Xem booking" (mở danh sách UC10 lọc theo email) và "Tạo booking" (mở UC08 với thông tin điền sẵn).
- Test: backend e2e 6, frontend 8 (gồm hai ca điền sẵn và đọc `q` từ URL).

### UC15 Same-Day Check-In/Out List — PR #48
- `GET /front-desk/same-day?date=`: khách đến (chưa cọc, đã xác nhận, đã nhận phòng) và khách đi (đang ở, đã trả phòng) trong ngày; sắp theo số phòng kiểu số; kèm tổng hợp phần còn phải xử lý.
- Tách hàm dựng dòng booking dùng chung với UC10 (`toBookingListItem`).
- Giao diện: `/reception/front-desk`, nơi gắn các nút Check In, Phụ phí, Thu tiền và Check Out ở các task sau.
- Test: backend e2e 6, frontend 4.

### UC16 Check In Guest — PR #49
- `POST /bookings/:id/check-in`: booking `CONFIRMED` chuyển `CHECKED_IN`, ghi `checkedInAt`, các phòng sang `OCCUPIED`. Cho nhận phòng từ ngày nhận đến trước ngày trả (đến muộn trong thời gian ở vẫn được); phòng phải hoạt động và `AVAILABLE`.
- Phòng chưa sẵn sàng có thể **đổi sang phòng khác cùng loại** ngay lúc check-in (`replacements`), tiền phòng không đổi. `GET /bookings/:id/check-in-options` cho biết phòng nào sẵn sàng và có thể đổi sang phòng nào.
- Vì Mongo ở đây không có transaction, mọi bước ghi đều có điều kiện và hoàn tác khi một phòng bị lấy mất.
- Giao diện: nút Check In trong danh sách khách đến, kèm khung chọn phòng thay thế.
- Test: backend unit 10 và e2e 13 (có hai ca đồng thời), frontend 5.

### UC17 Record Checkout Additional Charge — PR #50
- `POST /bookings/:id/charges` (số tiền 1 đến 100.000.000 VND, lý do tối đa 200 ký tự, `requestId`) và `GET /bookings/:id/charges`. Dùng lại `InvoicesService.addCharge` của Hiếu; chỉ ghi cho booking `CHECKED_IN`. `requestId` chống ghi trùng: gửi lại cùng nội dung thì không ghi thêm, khác nội dung thì 409.
- Giao diện: nút "Phụ phí" ở khách đi, mở khung xem khoản phí, tổng hợp hóa đơn và form thêm khoản.
- Test: backend e2e 9 (thêm 1 ca ở PR #51), frontend 8.

### UC18 Check Out Guest — PR #51
- Quyết định nghiệp vụ: **chỉ check-out khi hóa đơn đã thanh toán đủ**; lễ tân thu tiền bằng VNPay hoặc tiền mặt rồi xác nhận.
- `POST /bookings/:id/payments/cash`: ghi thanh toán cuối bằng tiền mặt; số tiền do server tính từ hóa đơn (client không gửi được), chống trùng bằng `requestId`, chỉ một thanh toán cuối cho mỗi booking, từ chối khi còn VNPay đang chờ.
- `POST /bookings/:id/check-out`: booking `CHECKED_IN` đã trả đủ chuyển `CHECKED_OUT` kèm `checkedOutAt`, các phòng `OCCUPIED` chuyển `CLEANING`. Hóa đơn tính lại trước và sau khi đóng.
- Sửa nhỏ UC17: sau khi đã thanh toán cuối thì không ghi thêm phụ phí.
- VNPay dùng lại `POST /payments/final` có sẵn của Hiếu (mở trang VNPay ở tab mới, nút Tải lại).
- Test: backend unit 3 và e2e 22 (tiền mặt 11, check-out 10, phụ phí sau thanh toán 1), frontend 7.

### UC39 Submit Feedback — PR #52
- `POST /feedback` (Customer): chỉ gửi cho booking của chính khách và đã `CHECKED_OUT`; điểm 1 đến 5 không bắt buộc, nội dung 1 đến 2000 ký tự; mỗi booking một phản hồi (kể cả khi gửi đồng thời). `GET /feedback/mine`: các lần lưu trú đã trả phòng kèm phản hồi đã gửi và câu trả lời của lễ tân.
- Giao diện: `/my-feedback`; thêm component `TextAreaField` và `RatingStars` dùng chung.
- Test: backend e2e 10, frontend 7.

### Layout chung, routing theo role, Home Page — PR #53
- `frontend/src/app/navigation.ts` là **nguồn duy nhất của menu theo role** (thay danh sách tạm trong `UserMenu`), kèm trang làm việc của từng role (`roleHome`) và hàm tách route khu nhân viên.
- Hai khung giao diện: **khung nhân viên** (`StaffLayout`: thanh bên nhóm theo role, thanh trên, ngăn kéo dưới 1024px) và **khung khách** (`PublicLayout`: header gọn, thu lại dưới 768px). Router tự chia route theo tiền tố `/staff`, `/manager`, `/reception`, `/operations`; **không đổi URL nào** và không sửa route của feature nào.
- Sau đăng nhập, nhân viên vào trang làm việc của role; khách về trang đang xem dở hoặc trang chủ.
- Trang chủ mới: hero kèm minh họa SVG, thanh tìm phòng, ba bước đặt phòng, lối vào theo vai trò.
- Test: frontend 69 (menu 11, khung nhân viên 12, router 23, header khách 9, trang chủ 10, đăng nhập thêm 4).

### Reception Dashboard — PR #54
- `GET /dashboard/reception`: ba khối của hôm nay, mỗi khối độc lập (lỗi một nguồn chỉ làm khối đó không khả dụng): đến/đi, trạng thái phòng, việc chờ lễ tân (yêu cầu dịch vụ, sự cố chờ duyệt, phản hồi chưa trả lời). Chỉ trả số tổng hợp.
- Giao diện: `/reception/dashboard` (tự làm mới mỗi 60 giây); trang đích sau đăng nhập của Lễ tân.
- Test: backend unit 5 và e2e 4, frontend 9.

## 4. Quyết định thiết kế chung

- **Chống ghi trùng bằng `requestId`** (UC17, cash UC18): giao diện sinh một mã cho mỗi lần lưu và giữ nguyên mã khi lưu lỗi; server dùng mã làm khoá nên bấm hai lần hay thử lại không ghi trùng.
- **Không có transaction nên ghi có điều kiện và hoàn tác** (UC11, UC16, UC18): chuyển trạng thái chỉ khi còn đúng trạng thái cũ; khi tranh chấp thì bên có `_id` nhỏ hơn thắng, bên thua hoàn tác và trả 409.
- **Số tiền luôn do server tính** (tiền mặt, tiền cọc, giá phòng): client không gửi số tiền.
- **Dùng lại, không viết lại**: logic phòng trống (`AvailabilityService`), tính hóa đơn (`InvoicesService`), thanh toán VNPay (`/payments/final`), `DashboardCard` của Manager Dashboard.
- **Hợp đồng `UserMenu` được giữ nguyên**: khoảng 15 test của các bạn render `<UserMenu />` và kiểm tra link theo role; file test đó không bị sửa. Chế độ `compact` chỉ dành cho header khách.
- **Tách commit nhỏ** theo yêu cầu: logic thuần, endpoint, test, API client, giao diện, test giao diện.

## 5. Phụ thuộc và tác động tới người khác

| Với | Nội dung |
|---|---|
| Hiếu | Dùng `AvailabilityService`, `InvoicesService.addCharge/recalculate`, `/payments/final` mà không sửa code. `BookingsModule` xuất thêm `FrontDeskService` và `RoomStatusBoardService`. UC21 (thanh toán cuối) hiện có thêm đường tiền mặt ở UC18. |
| Dương | UC39 tạo dữ liệu cho UC40 và UC41; `PublicLayout` và `StaffLayout` thay khung cũ. |
| Lâm | Manager Dashboard giữ nguyên; `DashboardModule` được mở rộng thêm một controller và một service. |
| Vũ | Yêu cầu dịch vụ và sự cố chờ duyệt được đếm ở Reception Dashboard; các dashboard nhân viên nay nằm trong khung nhân viên (xử lý `TODO(#18)`). |
| Cả nhóm | **Trang mới muốn có trong menu thì thêm một mục vào `frontend/src/app/navigation.ts`** (nhãn không trùng trong cùng role); đã ghi vào README. `renderWithAuth` nhận thêm tham số `state` (tuỳ chọn, tương thích ngược). |

## 6. Tồn đọng và giới hạn đã biết

1. **VNPay chưa thử thật.** VNPay chỉ ghi nhận thành công khi VNPay gọi được vào địa chỉ IPN công khai của hệ thống. Trên máy dev giao dịch kẹt ở trạng thái chờ và không check-out được; luồng VNPay mới được kiểm tra bằng test giả lập, chưa chạy với sandbox.
2. **Giao diện chưa kiểm tra bằng mắt ở 375px** (trang chủ, header khách, khung nhân viên) và chưa xem khung nhân viên, ngăn kéo trên trình duyệt. Đã xem trang chủ trên desktop và sửa hai lỗi (số "01" bị phông vẽ kiểu cổ, cột số bước lệch). Phần chỉnh đẹp xấu do Khoa tự làm sau.
3. **Test e2e `booking-payment-flow` (của Hiếu) fail nếu tái sử dụng DB test đã chạy trước đó**, cả trên `main`; pass trên DB mới. CI dùng DB mới nên không ảnh hưởng.
4. **Chưa chạy đủ toàn bộ `test:e2e` backend** trên máy; chỉ chạy các nhóm liên quan trên DB riêng tên `hms_*_test`. CI trên PR chạy đủ.
5. **Tìm khách (UC14) quét cả collection `bookings`** (không có index phù hợp cho regex và so khớp email viết thường). Ổn ở quy mô đồ án; dữ liệu lớn cần lưu email đã chuẩn hoá và đánh index.
6. **Đổi phòng lúc check-in** chỉ cùng loại phòng, và việc kiểm tra phòng thay thế còn trống không nằm trong cùng một transaction với việc chiếm phòng: nếu đúng lúc đó có booking mới đặt trùng phòng thay thế thì chưa bị chặn.
7. **Chỉ thêm, không sửa hoặc xoá** phụ phí và phản hồi; mỗi booking chỉ một thanh toán cuối nên phụ phí phát sinh sau khi đã thu xong bị chặn.
8. **Check-out chưa kiểm tra** yêu cầu dịch vụ hay sự cố còn mở của booking.
9. **Khách không có tài khoản** (đặt không đăng nhập, walk-in) không gửi được phản hồi vì schema `Feedback` bắt buộc có `customer`.
10. **Trang `/booking/:id` (UC09)** vẫn đọc từ `localStorage` của thiết bị nên các link "xem booking" của lễ tân có thể chưa mở được booking của khách khác, cho đến khi UC09 có API đọc chi tiết (task của Hiếu).
11. **Jira**: cả 12 task đang ở In Testing; chưa task nào được chuyển Done.

## 7. Chạy và kiểm tra

Cần Node 24 trở lên và npm 11 (máy Khoa đang dùng Node 22 nên khi làm đã chạy bằng Node 26 của Homebrew; dùng `nvm use` để theo `.nvmrc`).

```bash
# Backend (thư mục backend/)
npm ci
npm run lint && npm run typecheck && npm test
# e2e cần MongoDB và một database riêng tên hms_*_test, dùng DB mới mỗi lần
MONGODB_URI=mongodb://127.0.0.1:27017/hms_demo_test NODE_ENV=test \
  npx vitest run --config ./vitest.config.e2e.ts test/check-out.e2e-spec.ts

# Frontend (thư mục frontend/)
npm ci
npm run lint && npm test && npm run build
```

### Kịch bản demo nhanh (tài khoản mẫu sau `npm run seed`)
1. Đăng nhập `receptionist@hms.local`: vào thẳng **Tổng quan lễ tân** (`/reception/dashboard`).
2. **Tìm khách** (`/reception/guests`) rồi bấm "Tạo booking" để mở UC08 với thông tin điền sẵn; tạo booking walk-in.
3. **Danh sách booking** (`/reception/bookings`): lọc, bấm "Sửa" để đổi ngày hoặc phòng (UC11).
4. **Sơ đồ phòng** (`/reception/rooms`): xem trạng thái theo ngày và tầng.
5. **Đến và đi trong ngày** (`/reception/front-desk`): bấm **Check In** ở khách đến (thử đổi phòng nếu phòng chưa sẵn sàng).
6. Ở khách đi: bấm **Phụ phí** để ghi phụ phí, **Thu tiền mặt** để thu nốt hóa đơn, rồi **Check Out**; phòng chuyển sang "đang dọn".
7. Đăng nhập `customer@hms.local`, mở `/my-feedback` để gửi phản hồi cho lần lưu trú đã trả phòng; lễ tân trả lời ở `/staff/feedback` (UC40, UC41 của Dương).

## 8. Phụ lục

### Endpoint do Khoa thêm
| Method và đường dẫn | Role | Hạng mục |
|---|---|---|
| `POST /bookings/walk-in` | Lễ tân | UC08 |
| `GET /bookings` | Lễ tân | UC10 |
| `PATCH /bookings/:id` | Lễ tân | UC11 |
| `GET /room-status-board` | Lễ tân | UC13 |
| `GET /guests` | Lễ tân | UC14 |
| `GET /front-desk/same-day` | Lễ tân | UC15 |
| `POST /bookings/:id/check-in`, `GET /bookings/:id/check-in-options` | Lễ tân | UC16 |
| `POST /bookings/:id/charges`, `GET /bookings/:id/charges` | Lễ tân | UC17 |
| `POST /bookings/:id/payments/cash`, `POST /bookings/:id/check-out` | Lễ tân | UC18 |
| `POST /feedback`, `GET /feedback/mine` | Customer | UC39 |
| `GET /dashboard/reception` | Lễ tân | Reception Dashboard |

### Trang giao diện do Khoa thêm
`/` (Trang chủ mới), `/reception/dashboard`, `/reception/front-desk`, `/reception/rooms`, `/reception/bookings`, `/reception/bookings/:code/edit`, `/reception/booking/new`, `/reception/guests`, `/my-feedback`.

### File đáng đọc đầu tiên
- Backend: `backend/src/modules/bookings/` (UC08, UC10, UC11, UC13, UC15, UC16), `backend/src/modules/guests/` (UC14), `backend/src/modules/invoices/` (UC17, UC18), `backend/src/modules/feedback/` (UC39), `backend/src/modules/dashboard/reception-dashboard.*`.
- Frontend: `frontend/src/app/navigation.ts`, `frontend/src/layouts/`, `frontend/src/features/booking/`, `frontend/src/features/feedback/pages/MyFeedbackPage.tsx`, `frontend/src/features/dashboard/pages/ReceptionDashboardPage.tsx`.
