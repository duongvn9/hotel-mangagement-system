# Tiến độ phần việc của Nguyễn Công Hiếu

> Cập nhật: 23/10/2026. Dành cho Hiếu, thành viên trong nhóm và AI agent đọc trước khi tiếp tục triển khai.
> Tài liệu phối hợp: [HUONG-DAN-TRIEN-KHAI.md](HUONG-DAN-TRIEN-KHAI.md), [README](../README.md), [TIEN-DO-DUONG.md](TIEN-DO-DUONG.md).
> Phân biệt rõ: hoàn thành core/foundation không đồng nghĩa hoàn thành use case end-to-end. Trạng thái Git dưới đây dựa trên remote-tracking hiện có khi lập tài liệu; cần fetch trước khi chọn base cho công việc mới.

## 1. Đọc nhanh

- H5 schemas đã merge vào `main` qua PR #12.
- H7 invoice calculation và `InvoicesService` đã merge qua PR #13; nay đã có nguồn pricing thực từ `RoomType.basePrice` (`RoomTypePricingAdapter`).
- H6 availability core đã merge qua PR #14; nay đã nối Room adapter thật (model Room của Lâm) và có endpoint UC05 công khai — UC05 end-to-end.
- VNPay foundation + settlement persistence (compare-and-set) + endpoint thanh toán (cọc/thanh toán cuối, Return, IPN) đã merge vào `main`.
- UC20 đặt cọc (#47) và UC21 thanh toán cuối (#52) đã có settlement + endpoint + test; nay số tiền tính từ pricing thực. Còn chờ Guest authorization và sandbox acceptance với credentials thật.
- Create Booking (#46) đã triển khai: `POST /api/v1/bookings` tạo booking PENDING_DEPOSIT + RoomHold concurrency-safe, pricing server-side. Nối với UC20 để đặt cọc.
- Không tạo lại các schema hoặc enum đã có; không coi kết quả availability là bảo đảm đặt phòng thành công.
- Không tạo lại các schema hoặc enum đã có; không coi kết quả availability là bảo đảm đặt phòng thành công.

## 2. Bảng tiến độ

| Hạng mục | Đã hoàn thành | Còn thiếu | Trạng thái |
|---|---|---|---|
| H5 — Booking & Payment contracts | Booking, RoomHold, Invoice, PaymentTransaction; enum; indexes; seed; tests | Dữ liệu Room thực cho seed booking; nối seed feedback vào booking thật | Đã merge PR #12 |
| #45 / H7 — Invoice calculation | Calculator, service, charge ledger, payment reconciliation, adapters, tests; pricing thực từ RoomType.basePrice | Nguồn service charges và tích hợp workflow | Core/service merge PR #13; pricing adapter thật đã push |
| #43 / H6 — UC05 Search Available Rooms | Overlap core, Booking/Hold queries, clock, Room adapter thật, public endpoint `GET /availability`, DTO, Swagger, e2e | — | End-to-end; đã push |
| VNPay foundation | Config, ký URL, xác minh Return/IPN, validation, processing plan, tests | — | Đã merge main |
| VNPay settlement + endpoints | Mongo settlement port (CAS, idempotent), initiation service, controller (deposit/final/Return/IPN), authorization Customer/staff, e2e | Guest token auth, sandbox acceptance, HTTPS IPN khi deploy | Đã merge main |
| #46 — Create Booking | Endpoint `POST /bookings`, pricing server-side, availability recheck, hold concurrency-safe (_id tiebreaker), rollback, e2e | Guest ẩn danh, endpoint huỷ/hết hạn chủ động, đơn giá snapshot từng phòng | Đã push |
| #47 — UC20 Make Deposit Payment | Payment schema, H7, VNPay settlement + endpoint + test; tiền tính từ pricing thực | Guest auth, sandbox acceptance | Settlement/endpoint xong |
| #52 — UC21 Pay Final Invoice | H7 pricing thực, VNPay settlement + endpoint theo dư nợ + test | Sandbox acceptance | Settlement/endpoint xong |

## 3. Contracts dùng lại

### 3.1 H5 — Dữ liệu

Các schema nằm trong `backend/src/modules/bookings/`, `invoices/`, `payments/`.

- `Booking`: nhiều Room ObjectId, thông tin khách vãng lai, Customer tùy chọn, ngày lưu trú, tiền phòng/cọc và trạng thái.
- `RoomHold`: booking, nhiều phòng, khoảng lưu trú, `expiresAt`, `isActive`; TTL chỉ phục vụ dọn dữ liệu.
- `Invoice`: breakdown tiền phòng/dịch vụ/phụ phí/giảm giá/thuế, tổng tiền, tiền đã trả, dư nợ; H7 bổ sung charge ledger.
- `PaymentTransaction`: booking/invoice, transaction reference duy nhất, provider reference, method, purpose, status, amount, paidAt.
- Dùng tiền nguyên VND, ObjectId references, timestamps UTC và quy ước `isActive` hiện có.

`BookingStatus` dùng chung tại `backend/src/common/constants/booking-status.enum.ts`:

```text
PENDING_DEPOSIT, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED
```

Seed `SEED-CHECKED-IN-001` idempotent, chỉ được tạo nếu User và Room cần thiết tồn tại và đang hoạt động. Không tạo Room/User giả để ép seed thành công.

### 3.2 H7 — Invoice

```ts
getOrCreateForBooking(bookingId: string): Promise<InvoiceDocument>
addCharge({ bookingId, type, amount, reason, sourceId? }: AddInvoiceCharge): Promise<InvoiceDocument>
recalculate(bookingId: string): Promise<InvoiceDocument>
```

- Export qua `InvoicesModule`; tích hợp nguồn dữ liệu bằng `InvoicesModule.withAdapters(PricingAdapter, ChargesAdapter?)`.
- Pricing mặc định fail-closed khi thiếu nguồn giá authoritative, không suy đoán từ client totals.
- Charge types: `SERVICE`, `ADDITIONAL`, `DISCOUNT`, `TAX`.
- Caller nội bộ phải kiểm tra quyền và phê duyệt trước `addCharge`.
- Truyền `sourceId` ổn định để chống cộng trùng; không có source ID thì mỗi lần gọi là một charge riêng.
- Chỉ tính payment `SUCCESS` hợp lệ, phân biệt `DEPOSIT` và `FINAL`; không dùng số tiền cọc dự kiến như khoản đã thanh toán.
- Invariant: `balanceDue = totalAmount - depositPaid - finalPaid`.
- Optimistic concurrency của Invoice không tạo atomicity cho Booking/PaymentTransaction/Invoice.

### 3.3 H6 — Availability

```ts
AvailabilityService.findAvailableRooms({ checkIn, checkOut, guests, roomTypeId? })
```

- Khoảng lưu trú nửa mở `[checkIn, checkOut)`; overlap khi `startA < endB && startB < endA`.
- Ngày nghiệp vụ theo Việt Nam, so sánh timestamp nhất quán.
- Booking active `CONFIRMED`/`CHECKED_IN` có giao nhau sẽ chặn phòng.
- `CANCELLED`/`CHECKED_OUT` không chặn qua reservation; điều kiện vận hành phòng được xét riêng.
- `PENDING_DEPOSIT` không tự chặn vô thời hạn; cần hold còn hiệu lực.
- Hold phải active, chưa hết hạn và giao khoảng lưu trú; không phụ thuộc MongoDB TTL đã xóa document hay chưa.
- Hold có booking cha inactive/cancelled/checked-out không chặn. Hold thiếu booking cha được xử lý bảo thủ đến hết hạn; cần giữ chính sách này rõ ràng khi tích hợp workflow.
- Room adapter thật: `MongoAvailabilityRoomSource` (`mongo-availability-room-source.ts`) đọc model Room, populate RoomType. Ánh xạ (Hiếu quyết định vì RoomType tách adult/child): `capacity = adultCapacity + childCapacity`; `operationallyAvailable = status !== MAINTENANCE` (OCCUPIED/CLEANING do overlap reservation xử lý). Phòng thiếu RoomType bị loại.
- Endpoint UC05: `GET /api/v1/availability` `@Public()`, DTO `SearchAvailabilityDto` (checkIn/checkOut YYYY-MM-DD, guests, roomTypeId?), Swagger. Chỉ trả `{ id, roomTypeId, capacity }`, không lộ booking/customer.

Chi tiết: [H6-AVAILABILITY.md](H6-AVAILABILITY.md).

### 3.4 VNPay foundation

Nguồn chính: `backend/src/modules/payments/vnpay.protocol.ts`, `vnpay.service.ts` và `backend/src/config/vnpay.config.ts`.

- Đặc tả VNPay PAY 2.1.0; canonical encoding, HMAC-SHA512 và constant-time signature comparison.
- Tiền VND nguyên chuyển sang gateway bằng nhân 100; kiểm tra overflow, metadata và transaction relationship.
- Thành công yêu cầu đồng thời `vnp_ResponseCode = 00` và `vnp_TransactionStatus = 00`.
- Return chỉ xác minh/đọc; không cập nhật trạng thái từ trang redirect.
- `prepareIpn()` tạo plan `compare-and-set`, `duplicate` hoặc `review`.
- `VnpaySettlementPort` nay có `MongoVnpaySettlementPort` (`vnpay-settlement.adapter.ts`): compare-and-set trên PaymentTransaction là bản ghi tiền authoritative và pricing-independent; cọc thành công thì chuyển booking `PENDING_DEPOSIT` → `CONFIRMED` và đối chiếu paid amounts theo invariant H7. Trả về `committed`/`duplicate`/`conflict` để IPN idempotent. Dùng CAS + optimistic concurrency, không dùng multi-document transaction.
- Endpoint (`PaymentsApiModule`, `payments.service.ts`, `payments.controller.ts`): `POST payments/deposit` (UC20), `POST payments/final` (UC21) yêu cầu đăng nhập, authorize booking owner hoặc Receptionist/Manager, tính tiền phía server (cọc từ booking, dư nợ từ H7), chặn pending/paid trùng, trả URL VNPay đã ký. `GET payments/vnpay/return` `@Public()` chỉ xác minh. `GET payments/vnpay/ipn` `@Public()` settle bền vững, ACK (`RspCode`) sau commit.
- Không ACK thành công chỉ vì tạo plan thành công.
- Guest authorization (token/capability cho khách vãng lai) vẫn chưa triển khai; hiện chỉ hỗ trợ Customer sở hữu booking và nhân viên lễ tân/quản lý.

Biến cấu hình: `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAYMENT_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL`. Không commit `.env`, không đưa secret vào frontend hoặc log.

## 4. Checklist công việc tiếp theo

### A. Review và thống nhất contracts

- [x] Review/merge nhánh VNPay foundation và kiểm tra CI remote.
- [x] Xác nhận Room/RoomType H3 từ Lâm đã merge trước khi nối adapter.
- [x] Thống nhất nguồn đơn giá (RoomType.basePrice) và cách tính thời lượng lưu trú (số đêm theo ngày nghiệp vụ).
- [ ] Xác nhận chính sách đặt cọc, thời hạn hold, thuế và giảm giá từ SRS/contracts; không tự đặt tỷ lệ.
- [ ] Thống nhất nguồn dữ liệu service/additional charges.

### B. Hoàn thiện UC05 / H6

- [x] Viết Room data adapter dùng model thật, capacity (adult+child), room type và operational status (loại MAINTENANCE).
- [x] Public search endpoint với `@Public()`, DTO validation và Swagger.
- [x] Chỉ trả dữ liệu phòng công khai, không lộ booking/customer.
- [x] Thêm HTTP/DB integration tests với Room/RoomType thật.

### C. #46 — Create Booking

Nguồn: `bookings.service.ts`, `bookings.controller.ts` (`POST /api/v1/bookings`), `dto/create-booking.dto.ts`.

- [x] DTO + authorization: endpoint yêu cầu đăng nhập; Customer đặt cho chính mình, Receptionist/Manager đặt hộ (walk-in). Guest ẩn danh hoãn lại chờ thiết kế Guest-auth riêng.
- [x] Tính giá phía server (Σ basePrice × số đêm) lưu vào `roomTotal`; H7 recompute cùng công thức để kiểm chứng.
- [x] Kiểm tra availability lại tại thời điểm đặt (booking Confirmed/CheckedIn + hold còn hiệu lực).
- [x] Hold concurrency-safe: tạo RoomHold rồi verify, hold `_id` nhỏ nhất thắng, kẻ thua rollback → chống double booking.
- [x] Tạo Booking (PENDING_DEPOSIT) + RoomHold nhất quán; retry mã booking trùng; hold có `expiresAt` + TTL; lỗi tạo hold thì xoá booking mồ côi.
- [x] Kiểm thử hai request cùng phòng đồng thời (đúng một thắng) và rollback kẻ thua.
- [ ] Nối seed feedback sang booking thật khi đủ dữ liệu tham chiếu (thuộc seed của Dương).

> Giả định cần SRS xác nhận: `depositAmount = roomTotal` (trả trước toàn bộ tiền phòng), cửa sổ giữ phòng 15 phút. Chưa có endpoint huỷ/hết hạn chủ động (dựa TTL của hold). Snapshot giá là `roomTotal` tổng hợp; chưa lưu đơn giá từng phòng nên đổi giá RoomType về sau có thể lệch khi H7 recompute.

### D. #47 — UC20 đặt cọc

- [x] Xác thực ownership (Customer sở hữu) hoặc quyền nhân viên trước payment initiation. Guest capability/token vẫn chưa làm.
- [x] Xác định tiền cọc từ chính sách server (`booking.depositAmount`), không nhận tổng tiền từ frontend.
- [x] Persist pending payment attempt trước redirect; chặn pending/paid trùng.
- [x] Durable IPN processing: CAS + unique provider reference + replay checks (idempotent). Receipt/outbox chưa làm.
- [x] Bảo đảm nhất quán PaymentTransaction/Invoice/Booking bằng CAS + optimistic concurrency (không dùng multi-document transaction).
- [x] Chỉ chuyển trạng thái booking (`CONFIRMED`) sau khi commit settlement bền vững.
- [x] ACK IPN sau commit + concurrency/replay tests. HTTPS IPN là việc khi deploy.
- [ ] Sandbox acceptance test với cấu hình được cấp qua kênh riêng.

### E. #52 — UC21 thanh toán cuối

- [x] Tính dư nợ từ H7 (`recalculate`) tại thời điểm initiation.
- [x] Áp dụng ownership/quyền nhân viên; không public endpoint khởi tạo.
- [x] Tạo final-payment attempt và dùng chung settlement infrastructure.
- [x] Ngăn double payment (chặn pending/paid trùng) và callback conflict (CAS trả conflict/duplicate).
- [x] Kiểm thử settlement, callback lặp, unknown order, Return read-only.
- [ ] Dư nợ dựa trên pricing thực còn chờ model Room/RoomType của Lâm; sandbox acceptance.

Không tự mở rộng sang Checkout, Service Order, frontend hoặc refund khi chưa có yêu cầu/phân công riêng.

## 5. Phụ thuộc và bàn giao

| Bên liên quan | Cần phối hợp |
|---|---|
| Lâm / H3 | Room, RoomType, capacity, operational status và nguồn đơn giá |
| H4 / nguồn pricing | Snapshot giá, thời lượng tính tiền và quy tắc áp dụng giá |
| Service Order | Charge đã duyệt, stable source ID và quyền gọi H7 |
| Dương / auth và seed | Tái sử dụng guards; Guest authorization phù hợp; cập nhật feedback seed khi có booking thật |
| Nhóm triển khai | VNPay sandbox credentials qua kênh riêng, IPN HTTPS, Mongo transaction support nếu dùng transaction |
| Frontend / workflow consumers | Chờ contracts API thực; không dùng Return URL như bằng chứng thanh toán thành công |

## 6. Kiểm thử đã chạy

Đây là kết quả tại từng mốc triển khai, không phải khẳng định đã chạy lại khi sửa tài liệu này.

| Mốc | Unit tests | E2E | Lint / Typecheck / Build |
|---|---|---|---|
| H5 | 55 pass | 26 pass | PASS |
| H7 | 99 pass | 29 pass | PASS |
| H6 | 130 pass | 30 pass | PASS |
| VNPay foundation | 208 pass, gồm 78 VNPay tests | 30 pass | PASS |
| VNPay settlement + endpoints | 340 unit pass | 57 e2e pass (gồm 4 settlement + 7 payments) | PASS (lint/typecheck/build) |
| UC05 adapter/endpoint + pricing thật | 460 unit pass | 101 e2e pass (gồm 5 UC05 + 1 pricing) | PASS (lint/typecheck/build) |
| #46 Create Booking | 460 unit pass | 109 e2e pass (gồm 8 create booking) | PASS (lint/typecheck/build) |

- Backend được kiểm thử trên Node 24 (lượt này Node 22); E2E dùng MongoDB 8 và database test riêng. E2E chạy ổn định với `--no-cache` để tránh phụ thuộc thứ tự suite dùng chung DB.
- VNPay có digest đối chiếu độc lập, không chỉ tự ký rồi tự verify.
- UC20/UC21 đã có e2e settlement + endpoint với MongoDB thật; nay pricing dùng adapter thật. Chưa có test giao dịch thanh toán thật qua sandbox VNPay.
- UC05 e2e dùng Room/RoomType thật (overlap, loại MAINTENANCE, lọc số khách, query sai); pricing e2e kiểm tra 2 phòng × 3 đêm.
- Khi sửa code phải chạy lại trong thư mục `backend`:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

E2E chỉ chạy khi có MongoDB phù hợp; không dùng database dev/production để chạy test có thao tác dữ liệu.

## 7. Các mốc Git

| Mốc | Branch | Commit | Trạng thái |
|---|---|---|---|
| H5 | `feature/hieunc-h5-schemas` | `5bb9a9730ccf65d964590711f650d05949f18e18` | Merged PR #12 |
| H7 | `feature/hieunc-h7-invoice` | `3b7f19e5168d7a60502dfebb1e9a079742e2a1a8` | Merged PR #13 |
| H6 | `feature/hieunc-h6-availability` | `61b831e7ed3242204bc9bfd6adde7659106191d9` | Merged PR #14 |
| VNPay foundation | `feature/hieunc-vnpay-foundation` | `03f6bfffae3fe5c7e2494038646be6cd6d1dfb62` | Đã merge main |
| VNPay settlement persistence | `feature/hieunc-vnpay-foundation` | `d1a8bb5` | Đã merge main (e91521c) |
| VNPay deposit/final endpoints | `feature/hieunc-vnpay-foundation` | `f18f8df` | Đã merge main (e91521c) |
| UC05 Room adapter + endpoint | `feature/hieunc-availability-pricing` | `91e96db` | Đã merge main (7d41711) |
| H7 pricing từ RoomType | `feature/hieunc-availability-pricing` | `262e45e` | Đã merge main (7d41711) |
| #46 Create Booking | `feature/hieunc-create-booking` | (xem git log) | Đã push |

Commit messages tương ứng:

```text
feat(booking): add booking and payment schemas
feat(invoice): implement invoice calculation service
feat(booking): add room availability calculation core
feat(payment): add vnpay integration foundation
feat(payment): persist vnpay settlement with atomic compare-and-set
feat(payment): add vnpay deposit and final payment endpoints
feat(booking): wire room availability source and UC05 search endpoint
feat(invoice): price invoices from room type base price
feat(booking): add create booking with concurrency-safe room hold
```

## 8. Quy tắc cập nhật tài liệu

1. Khi bắt đầu task, cập nhật trạng thái và dependency; không đánh dấu use case hoàn thành chỉ vì có core.
2. Sau triển khai, ghi files/contracts quan trọng và kết quả test thực tế.
3. Sau push/merge, cập nhật commit, PR và trạng thái Git.
4. Chỉ đánh dấu checkbox hoàn tất khi công việc và kiểm chứng tương ứng đã xong.
5. Commit theo Conventional Commits, toàn bộ subject/body bằng tiếng Anh; chỉ stage file thuộc task, không commit secrets hoặc tài liệu SRS untracked ngoài phạm vi.
