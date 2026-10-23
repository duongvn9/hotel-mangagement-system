# Hướng dẫn triển khai Sprint 1

Mục tiêu: ngày đầu tiên (23/10) **cả 5 người đều code được**, không ai ngồi chờ người khác. Bảng phân công và cột "Cần xong trước" nằm ở [README mục 7](../README.md#7-kế-hoạch-sprint-1-và-phân-công).

Ý chính: phần lớn phụ thuộc trong kế hoạch là phụ thuộc **về dữ liệu và chữ ký hàm**, không phải về code đã chạy xong. Nếu chốt sớm "hợp đồng" (schema, enum, chữ ký service, route) thì mỗi người code song song phần của mình, dùng dữ liệu giả cho phần của người khác, rồi nối thật khi người kia merge.

---

## 1. Nhận biết task nào làm được ngay

Mỗi task rơi vào một trong ba màu. Xem cột "Cần xong trước" (README) hoặc link "is blocked by" trên Jira.

| Màu | Dấu hiệu | Làm gì |
|---|---|---|
| **Xanh** — làm ngay | Cột "Cần xong trước" trống, chỉ có #13 (đã xong), chỉ có #14, hoặc chỉ có task của chính mình | Làm trọn BE + FE. Với #14: tự viết Mongoose schema cho module của mình (mục 2.1), không cần chờ Dương. |
| **Vàng** — làm trước, nối sau | Phụ thuộc task của người khác nhưng chỉ cần **dữ liệu** hoặc **chữ ký hàm** của task đó | Code theo hợp đồng ở mục 3, dùng stub/mock cho phần chưa có. Ghi `// TODO(#<số task>): nối thật` ở chỗ dùng stub. |
| **Đỏ** — phải chờ | Cần hành vi chạy thật của task khác để kiểm tra end-to-end (ví dụ Pay Final Invoice cần callback VNPay của Deposit) | Làm trước phần UI và phần logic không phụ thuộc, nhưng chỉ chuyển Jira sang Done khi task kia đã merge. |

Quy tắc nhanh: **một task chỉ thật sự bị chặn khi bạn không thể viết test cho nó** kể cả khi dùng dữ liệu giả. Nếu viết được test, task đó là xanh hoặc vàng.

---

## 2. Ba cách mở khóa để không phải chờ

### 2.1 Mỗi module tự sở hữu schema của mình

Dự án dùng MongoDB nên không có migration chung chạy tuần tự. Task #14 của Dương **không chặn** người khác nếu chia như sau:

- **Dương (#14)** làm: schema `User`, `Role`, `Permission`; file quy ước chung (mục 3.1); script seed tổng `npm run seed` gọi lần lượt seed của từng module.
- **Mỗi người** viết schema cho entity thuộc module của mình trong `modules/<tên>/schemas/`, kèm file `seed.ts` nhỏ của module đó.

| Entity (ERD) | Module | Người viết schema |
|---|---|---|
| User, Role, Permission | `users`, `roles` | Dương |
| RoomType, Room, Amenity, Service, Equipment | `room-types`, `rooms`, `amenities`, `services`, `equipment` | Lâm |
| Booking, RoomHold, Invoice, PaymentTransaction | `bookings`, `invoices`, `payments` | Hiếu |
| Feedback | `feedback` | Khoa |
| Task, ServiceOrder, Issue | `tasks`, `service-orders`, `issues` | Vũ |

Tham chiếu sang entity của người khác: chỉ cần `@Prop({ type: Types.ObjectId, ref: 'Room' })`, không cần đợi schema `Room` có mặt.

### 2.2 Auth: đã chạy thật (cập nhật 23/10)

Xác thực Firebase và phân quyền đã ở `main` (#15). **Mọi endpoint mặc định cần đăng nhập**, nên gắn đúng ngay khi viết controller:

```ts
@Public()                                  // Guest gọi được (tìm phòng, xem phòng...)
@Roles(Role.Receptionist, Role.Manager)    // chỉ các role này, sai role thì 403
@Permissions('task:execute')               // thêm nếu muốn role do Manager tạo cũng dùng được (UC45)
handler(@CurrentUser() user: AuthUser) {}  // { id, email, role }
```

- Test theo role không cần Firebase: header `x-dev-role` (và `x-dev-user-id` lấy từ log `npm run seed`) qua Swagger/Postman.
- Frontend: bọc trang bằng `<RequireAuth roles={[...]}>`, lấy người dùng bằng `useAuth()`. Không điền `VITE_FIREBASE_*` thì trang đăng nhập cho chọn tài khoản mẫu; điền rồi thì đăng nhập Firebase thật (xem mục 2.4).
- Chi tiết, API và ví dụ: [`TIEN-DO-DUONG.md`](TIEN-DO-DUONG.md).

### 2.3 Frontend làm trước bằng dữ liệu giả

Trong `features/<tên>/api.ts`, mỗi hàm trả về dữ liệu giả cho tới khi backend xong:

```ts
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export async function getRoomTypes(): Promise<RoomType[]> {
  if (USE_MOCK) return mockRoomTypes            // features/<tên>/mocks.ts
  return (await api.get('/room-types')).data
}
```

Kiểu dữ liệu (`RoomType`, `Booking`…) lấy theo hợp đồng ở mục 3 để khi bỏ mock không phải sửa component.

### 2.4 Firebase của nhóm

- Project Firebase: **`hrm-wdp`** (tên HRM-WDP), đã bật đăng nhập Email/Password, đã có Web app "HMS".
- Muốn đăng nhập thật khi dev: điền vào `frontend/.env.local`

  ```
  VITE_FIREBASE_API_KEY=AIzaSyBliZJmXzvP61K1JmQdBllJImiVfw92fgA
  VITE_FIREBASE_AUTH_DOMAIN=hrm-wdp.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=hrm-wdp
  VITE_FIREBASE_APP_ID=1:846769117605:web:2a9a45a6ff93e88f78704c
  ```

  và `FIREBASE_PROJECT_ID=hrm-wdp` vào `backend/.env`. Đây là config Web công khai (vẫn bị nhúng vào JS gửi xuống trình duyệt), không phải secret.
- Service account (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, chỉ cần khi Manager tạo tài khoản nhân viên) là **secret**: xin Dương qua kênh riêng, không commit, không dán lên Jira hay nhóm chat chung.
- Để trống các biến `VITE_FIREBASE_*` thì quay lại chế độ dev (chọn tài khoản mẫu), tiện khi test nhiều role.

---

## 3. Hợp đồng cần chốt sớm

Đây là những thứ người khác phụ thuộc. Người sở hữu mở **một PR nhỏ chỉ chứa hợp đồng** (schema, enum, interface, service trả dữ liệu giả) trước hạn, rồi mới làm logic thật.

Trạng thái 23/10: **H1, H2 đã merge** (PR #1); H3–H10 chưa có trên `main`.

| # | Hợp đồng | Chủ sở hữu | Ai dùng | Hạn merge |
|---|---|---|---|---|
| H1 | Quy ước chung: tên collection số nhiều, `timestamps: true`, soft delete bằng `isActive`, format tiền (số nguyên VND), giờ lưu UTC, ngày nghiệp vụ theo `Asia/Ho_Chi_Minh` | Dương | Tất cả | 23/10 trưa |
| H2 | `@CurrentUser()` + header giả lập role ở dev; schema `User` | Dương | Tất cả | 23/10 |
| H3 | Schema `RoomType`, `Room` + enum `RoomStatus` (AVAILABLE, OCCUPIED, CLEANING, MAINTENANCE) | Lâm | Hiếu, Khoa | 23/10 |
| H4 | Schema `Service` (giá, đơn vị, `isActive`) | Lâm | Vũ, Hiếu | 23/10 |
| H5 | Schema `Booking` + enum `BookingStatus` (PENDING_DEPOSIT, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED) | Hiếu | Khoa, Vũ, Lâm | 23/10 |
| H6 | `AvailabilityService.findAvailableRooms({ checkIn, checkOut, guests, roomTypeId? })` export từ module `bookings` | Hiếu | Khoa (UC08, UC11, UC13) | 24/10 (lúc đầu trả dữ liệu giả) |
| H7 | `InvoicesService.getOrCreateForBooking()`, `addCharge({ bookingId, type, amount, reason })`, `recalculate()` | Hiếu | Khoa (UC17, UC18), Vũ (phí dịch vụ BR-SER-09) | 24/10 |
| H8 | Schema `Task` + enum `TaskStatus` (ASSIGNED, IN_PROGRESS, COMPLETED) + `TasksService.create({ sourceType, sourceId, assigneeId, ... })` | Vũ | Lâm (UC35, UC55), Vũ | 23/10 |
| H9 | `NotificationsService.send({ to, template, data })` (lúc đầu chỉ ghi log) | Lâm | Hiếu, Khoa | 24/10 |
| H10 | Layout theo role + chỗ gắn route: mỗi feature export `routes.tsx`, layout có slot menu | Khoa | Tất cả FE | 24/10 |

Muốn đổi hợp đồng sau khi đã merge: nhắn nhóm trước và sửa luôn chỗ người khác đang dùng trong cùng PR.

---

## 4. Từng người bắt đầu từ đâu

Thứ tự dưới đây đã tính phụ thuộc. Số `#` là số task trong README.

### Vũ Ngọc Dương (đường găng, cả nhóm ưu tiên review PR của Dương)

**Đã xong (23/10), đã ở `main`:** H1, H2, #13–#17, #19–#27, Firebase project `hrm-wdp`. Xem [`TIEN-DO-DUONG.md`](TIEN-DO-DUONG.md).

- Còn lại: seed booking `CHECKED_IN` mẫu (#14), làm ngay khi Hiếu merge schema `Booking` (H5).
- Việc tiếp: review PR hợp đồng H3–H10 của cả nhóm, hỗ trợ ai bị chặn vì auth/seed.

### Trần Bảo Lâm (dữ liệu gốc, nhiều người chờ)

1. H3 + H4 (23/10): schema `RoomType`, `Room`, `Service` + seed vài phòng mẫu. Merge sớm nhất có thể vì Hiếu, Khoa, Vũ cần.
2. #28–#35: màn hình và API CRUD cho Room Type, Room, Amenity, Service.
3. H9 + #36 Gmail notification: chỉ phụ thuộc #13, làm xen kẽ được bất cứ lúc nào.
4. #39 Manager Dashboard: dựng UI bằng dữ liệu giả, gắn vào layout khi H10 xong.
- Vàng: #37 Report Equipment Fault cần H8 của Vũ; #40, #42 cần Task; #41 Revenue cần dữ liệu thanh toán (dùng seed `PaymentTransaction` giả để làm trước).

### Nguyễn Công Hiếu (logic booking và tiền)

1. H5 (23/10): schema `Booking`, `RoomHold`, `Invoice`, `PaymentTransaction`.
2. #45 Service tính hóa đơn: hàm thuần, chỉ cần unit test, làm ngay. Xong thì mở H7.
3. #43 Search Available Rooms: viết logic phòng trống (BR-BOOK-02/03/04) dưới dạng hàm thuần nhận danh sách phòng và booking, test kỹ trường hợp trùng ngày. Dùng interface theo H3 trong lúc chờ Lâm merge. Xong thì mở H6.
4. Song song: đăng ký VNPay sandbox, viết sẵn hàm ký và kiểm tra chữ ký (`vnp_SecureHash`) cho #47. Phần này không phụ thuộc ai.
5. #44, rồi #46 Create Booking khi Room của Lâm đã merge.
- Đỏ: #52 Pay Final Invoice cần #47 và #61 chạy thật.

### Nguyễn Đăng Khoa (khung giao diện và lễ tân)

1. #18 + H10 (ưu tiên số 1, merge trước 24/10): layout cho Public, Customer, Receptionist, Staff, Manager; menu theo role; cách gộp `routes.tsx` của từng feature. Cả nhóm FE dùng cái này.
2. #53 Reception Dashboard, #54 Room Status Board, #55 Search Guest Profile: UI bằng dữ liệu giả, API đọc từ `Room` (H3) và `User` (H2).
3. #57 View Booking List khi có schema `Booking` (H5).
4. Vàng: #56 Create Booking for Guest và #58 Update Booking gọi `AvailabilityService` (H6); #61, #62 gọi `InvoicesService` (H7). Code theo chữ ký, chạy với dữ liệu giả trước.

### Lê Anh Vũ (task và quy trình xử lý)

1. H8 + #64 Task core (23/10): schema `Task`, máy trạng thái (BR-TASK-03) là hàm thuần có unit test, `TasksService.create()`.
2. #66 View Assigned Tasks, #67 Update Task Progress: làm ngay sau #64.
3. #65 Staff Dashboard: UI bằng dữ liệu giả, gắn layout khi H10 xong.
4. #74–#79 nhóm Issue: chỉ phụ thuộc #14 nên là việc xanh, có thể kéo lên làm sớm nếu đang chờ việc khác.
5. #68–#72 Service Order khi có schema `Service` (H4); test bằng booking `CHECKED_IN` trong seed, không chờ Check-in của Khoa.

---

## 5. Quy trình cho mỗi task

1. Trên Jira: kéo task sang **In Progress**. Nếu task đang có link "is blocked by" chưa xong, kiểm tra lại màu ở mục 1.
2. Tạo nhánh từ `main`: `feature/UC07-create-booking` (task không có UC thì dùng số task, ví dụ `feature/64-task-core`).
3. Đọc đặc tả UC trong SRS (luồng chính, luồng phụ, ngoại lệ) và các BR liên quan ở SRS mục 5.1.
4. Backend: schema → service + unit test cho từng BR → DTO + controller + `@Roles()` / `@Public()` → kiểm tra trên Swagger (`/api/docs`).
5. Frontend: `features/<tên>/api.ts` (mock trước) → `hooks.ts` → `pages/` → `routes.tsx`. Dùng token màu và class trong `DESIGN.md`.
6. Còn dùng stub hoặc mock: ghi `// TODO(#<số task>)` và comment trên Jira là đang chờ gì.
7. Mở PR vào `main`, tiêu đề có mã task Jira. CI xanh, ít nhất 1 người review. PR nên dưới khoảng 400 dòng; task lớn thì tách thành PR hợp đồng và PR logic.
8. **Done** khi: đã merge, chạy được với `docker compose up --watch`, không còn mock cho phần đã có backend, Swagger đúng.

## 6. Khi bị chặn

- Không ngồi chờ: chuyển sang một task xanh khác của mình (mỗi người đều có ít nhất 2 task xanh ở mục 4).
- Comment trên task Jira bị chặn: chặn bởi task nào, cần gì cụ thể (một enum, một field, một hàm).
- Nhắn trực tiếp chủ task kia. Nếu quá nửa ngày chưa xử lý, báo trong buổi họp ngắn hằng ngày.

## Phase 4: VNPay sandbox foundation (Hiếu)

Đã chuẩn bị protocol, `VnpayService` export từ `PaymentsModule`, Joi/ConfigService và test Nest DI. Đây **không phải** hoàn thành UC20/UC21: không có controller, initiation công khai, DB write, gọi gateway, checkout, refund hay frontend.

### Đặc tả và cấu hình

Đối chiếu tài liệu chính thức ngày 23/10/2026:
- https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
- https://sandbox.vnpayment.vn/apis/docs/bang-ma-loi/

API `2.1.0`, command `pay`, VND; sắp xếp tên tham số tăng dần, `encodeURIComponent` theo mẫu Node của VNPAY, đổi `%20` thành `+`, ghép `&`, HMAC-SHA512 UTF-8 hex. Không dùng `URLSearchParams` để canonicalize vì cách encode punctuation khác mẫu Node. So sánh hash bằng `timingSafeEqual` sau kiểm tra đúng 128 hex. Bỏ `vnp_SecureHash` và `vnp_SecureHashType` khỏi dữ liệu ký; nếu hash type có mặt chỉ chấp nhận `HMACSHA512`.

Biến backend: `VNPAY_TMN_CODE` (8 chữ/số), `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL` (chỉ sandbox chính thức), `VNPAY_RETURN_URL`; `VNPAY_IPN_URL` tùy chọn, HTTPS, dành đăng ký với VNPAY chứ không gửi trong URL thanh toán. Không cấu hình vẫn boot; gọi service thiếu cấu hình sẽ 503, không ghi giá trị secret vào thông báo. URL callback không có credentials/query/fragment; HTTP chỉ dành return localhost. Không đặt secret trong VITE, log, repo hoặc frontend. Các URL trong env example chỉ là cấu hình mẫu, chưa có route hoạt động.

Số tiền là số nguyên VND dương, tối đa **9.999.999.999 VND**, suy ra từ trường `vnp_Amount Numeric[1,12]` và nhân 100; không phải khẳng định hạn mức thương mại của sandbox/ngân hàng. Từ chối số lẻ, NaN, Infinity, overflow, không làm tròn/cắt phần lẻ. `CreateDate`/`ExpireDate` bắt buộc, UTC chuyển `Asia/Ho_Chi_Minh`, `yyyyMMddHHmmss`; hết hạn phải sau khởi tạo. IP phải là IP hợp lệ; locale vn/en, bank tùy chọn. OrderInfo do server tạo `HMS {purpose} {transactionRef}` từ record, không nhận mô tả từ client.

### Return và chuẩn bị IPN

`verifyReturn(rawQuery, expected)` chỉ xác minh/đọc. Truyền **raw query chưa parse**, không truyền object `req.query` vì parser có thể làm mất duplicate. Từ chối trùng key kể cả percent-encoded, array/object syntax, unknown key, empty, invalid UTF-8/percent encoding, control character và query quá 8192 ký tự. Đây là chính sách fail-closed của HMS, không phải hạn mức VNPAY.

Callback cần TmnCode, Amount, BankCode, OrderInfo, TransactionNo, ResponseCode, TransactionStatus, TxnRef và SecureHash; BankTranNo/CardType/PayDate tùy chọn theo đặc tả. HMS yêu cầu PayDate hợp lệ và provider ref khác 0 khi thành công để đáp ứng invariant H7. Xác minh merchant, txnref, amount và metadata purpose; kiểm tra PaymentTransaction→Booking→Invoice, active, method VNPAY, enum hiện có. Expected phải được server đọc từ DB; không bao giờ lấy expected từ client. Không yêu cầu customer/Firebase nên Guest vẫn tương thích, nhưng chưa cấp quyền initiation.

Thành công chỉ khi **ResponseCode=00 AND TransactionStatus=00**; mẫu PHP có OR không được sao chép. ResponseCode 24 là hủy; các kết quả khác không ghi nhận thành công. `prepareIpn` trả plan compare-and-set cho pending và kết quả terminal rõ ràng; trạng thái chưa hoàn tất/đảo/refund/nghi ngờ hoặc mã mâu thuẫn trả review. Duplicate dựa trên trạng thái/provider ref/paidAt đã persist, không dựa cache trong RAM. Terminal conflict không được coi là duplicate. Plan chưa phải cập nhật DB và không được trả ACK thành công chỉ vì tạo plan thành công.

### Hợp đồng persistence đang chờ UC20/UC21

`VnpaySettlementPort.commitAtomically` là interface, **chưa có adapter thực thi**. Trước khi mở IPN cần:
1. Initiation được phân quyền: ownership Customer hoặc capability Guest có giới hạn; amount từ deposit policy hoặc balance hiện hành H7, không từ client. Persist transaction pending trước redirect, transactionRef duy nhất, không tái sử dụng; persist/freeze metadata và quan hệ của attempt.
2. Sau checksum, load expected theo txnref từ DB. Trong Mongo transaction/replica set: đọc lại và so sánh toàn bộ expected, CAS status Pending cùng amount/method/purpose/quan hệ; giữ unique index `(method, providerTransactionRef)` của H5. Provider ref `0` của giao dịch lỗi không được chiếm unique reference dùng cho giao dịch thực; adapter cần chính sách receipt riêng cho failure replay.
3. Cập nhật PaymentTransaction, Invoice, Booking và durable receipt/outbox trong cùng transaction; không cộng tiền/recalculate/notification lại khi duplicate. CAS thua phải đọc receipt đã commit và phân biệt duplicate/conflict. Không dùng plan cũ ngoài transaction. Receipt cần lưu cả response/status/fingerprint để phân biệt mọi replay khác nội dung; schema hiện tại chưa lưu các trường này.
4. H7 `optimisticConcurrency` chỉ bảo vệ một Invoice, **không** tạo atomicity xuyên collection. Cần session-aware adapter và pricing snapshot thật; H7 hiện fail-closed nếu chưa có `InvoicePricingAdapter`. Không gọi recalculate độc lập sau ghi payment rồi tuyên bố atomic.
5. IPN GET HTTPS, checksum trước lookup; trả JSON `RspCode`/`Message`: 00 sau commit, 02 sau xác nhận duplicate bền vững, 01 không tìm thấy, 04 sai amount, 97 sai chữ ký, 99 lỗi/conflict/chưa thể xử lý. 00/02 dừng retry; 01/04/97/99/timeout retry tối đa 10 lần, cách 5 phút theo tài liệu. Không dùng Return để ghi tiền hoặc trả ACK IPN.
6. Thêm Mongo replica-set integration/concurrency/crash-recovery test, guest authorization, current balance/deposit policy, notification outbox và kiểm thử sandbox thật trước đánh dấu UC20/UC21 Done. Foundation không thực hiện thanh toán thật.

Test fixture HMAC được tính độc lập bằng .NET HMACSHA512 trên canonical text cố định, không chỉ sign-then-verify cùng implementation. Test hiện có bao phủ config, timezone, amount boundary, signed tampering/metadata, duplicate query, relation mismatch, cancellation/failure/review và persisted duplicate/conflict ở lớp plan; Nest DI kiểm tra export service không cần Mongo. Chưa tuyên bố đã test concurrent persistent settlement.

## 7. Nhịp làm việc trong tuần

| Ngày | Mốc |
|---|---|
| Thứ Sáu 23/10 | Merge H1, H2, H3, H4, H5, H8. Mọi người đã có nhánh đầu tiên. |
| Thứ Bảy 24/10 | Merge H6, H7, H9, H10. Từ đây không còn ai phải dùng interface tự đoán. |
| Thứ Hai 26/10 | Hết đợt 1: auth thật, dữ liệu gốc, tìm phòng, task core |
| Thứ Tư 28/10 | Hết đợt 2. Tối 28/10 xem lại tiến độ, quyết định dời UC57, UC45, UC36 nếu trễ. |
| Thứ Sáu 30/10 | Hết đợt 3 |
| 31/10 – 01/11 | Ghép nối, test các luồng chính end-to-end, sửa lỗi |

Họp ngắn 15 phút mỗi ngày: mỗi người nói hôm qua merge gì, hôm nay làm gì, đang chờ ai. Ưu tiên review PR hợp đồng (H1–H10) và PR của Dương trước PR khác.
