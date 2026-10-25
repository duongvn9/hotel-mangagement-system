# Tiến độ Trần Bảo Lâm — Grand Emily HMS

Cập nhật 25/10/2026. Đây là tài liệu tiến độ và bàn giao duy nhất của Lâm; các task sau tiếp tục cập nhật vào file này. File CLAUDE-CONTEXT-TRAN-BAO-LAM.md giữ vai trò context dự án, không phải một file tiến độ theo UC.

## Hiện trạng mới nhất

| Phần việc | Trạng thái / revision |
|---|---|
| #28 UC49 | Đã merge main: 4134194 |
| #29 UC50 | Đã merge main: e49794c |
| Tách sức chứa adultCapacity/childCapacity | Đã merge main: cfb2394 |
| Sửa import Connection của Task | Đã merge main: 7684a45; seed toàn ứng dụng pass hai lần |
| #30 UC47 View Room List + H3 Room/RoomStatus | Đã merge main: 734ea16 |
| #31 UC48 Create / Update Room | Đã merge main: 21cc5d7; xem [bàn giao UC48](#uc48) |
| #32 UC51 View Amenity List | Đã triển khai/kiểm tra đầy đủ; PR #21, xem [bàn giao UC51](#uc51) |
| #37 UC35 Report Equipment Fault / Damage | Đã merge main: `d5f422c`, PR #35; backend/frontend/Docker CI xanh; xem [bàn giao UC35](#uc35) |
| #38 UC36 View Maintenance History | Đã merge main `62b548c`, PR #36; bốn job CI xanh; xem [bàn giao UC36](#uc36) |
| #40 UC55 Monitor Task Queues | Đang kiểm chứng trên `feature/40-task-queue-monitor`; xem [bàn giao UC55](#uc55) |

Hợp đồng RoomType hiện hành dùng adultCapacity và childCapacity, không dùng capacity. H6 vẫn giữ hợp đồng capacity/guests riêng; chưa nối adapter Room thật. Các mục lịch sử bên dưới ghi lại đúng trạng thái từng thời điểm, kể cả blocker đã được xử lý; không dùng snapshot cũ để kết luận trạng thái hiện tại.

## Quy trình Git thường trực

- Chỉ thị ngày 25/10/2026, áp dụng ngay: tính năng dùng `feature/...`, sửa lỗi dùng `fix/...`, việc khác dùng prefix phù hợp. Hoàn tất và kiểm chứng thì chủ động tạo PR nếu cần và merge main; không hỏi lại quyền tạo nhánh/PR/merge cho từng việc.

- Làm xong nhánh feature hoặc fix nào thì push và merge nhánh đó vào main bằng merge commit khi đủ scope và các kiểm tra đã pass hoặc được người dùng miễn rõ ràng; không dừng ở push.
- Sau merge, pull main mới nhất trước khi tạo nhánh tiếp theo. Fix tách từ feature phải giữ thứ tự phụ thuộc khi tích hợp vào main.
- Không force-push, không sửa Jira/nhánh người khác; commit Conventional Commits. Docker được miễn theo yêu cầu trước của người dùng, không báo là đã chạy/pass.

<a id="uc47"></a>
## #30 — UC47 View Room List và hợp đồng H3

Phạm vi: GET /api/v1/rooms, schema Room/RoomStatus, seed, trang /manager/rooms và kiểm thử. Chỉ đọc; không có nút hoặc API tạo/sửa/ngừng phòng (thuộc #31). Nhánh feature/30-room-list từ main 7684a45, commit triển khai 29b2038; gộp tài liệu 01314d5. Nhánh fix/30-room-status-schema xử lý các lỗi phát hiện khi kiểm tra.

### Hợp đồng H3 — Room và RoomStatus

- `common/constants/room-status.enum.ts`: đúng bốn giá trị AVAILABLE, OCCUPIED, CLEANING, MAINTENANCE; không thêm RESERVED/OUT_OF_SERVICE.
- Model `Room`, collection `rooms`, timestamps. Field: roomNumber string required/trim/unique chính xác; floor số nguyên an toàn bắt buộc; roomType ObjectId required ref RoomType; status enum required, mặc định AVAILABLE; notes trim, mặc định rỗng; isActive mặc định true.
- Sức chứa/giá ở RoomType; Amenity chỉ gắn RoomType. Không thêm field capacity/amenities/giá vào Room hoặc quan hệ Equipment trước task tương ứng.
- RoomsModule import RoomTypesModule một chiều, export RoomsService và MongooseModule. Module khác import RoomsModule và inject model qua getModelToken(Room.name); không tạo schema Room thứ hai.
- UC47 chỉ có `RoomsService.list(ListRoomsQuery)`. Điểm mở rộng #31: tái sử dụng schema/enum/module/API client/route/UI này rồi bổ sung endpoint ghi, validation references và form theo prompt UC48 riêng.
- Adapter H6 sau này đọc Room._id -> id, Room.roomType -> roomTypeId, Room.isActive và Room.status; cần populate RoomType để đọc isActive và hai field sức chứa. H6 vẫn dùng capacity/guests riêng; Hiếu quyết định ánh xạ. Không nối AvailabilityRoomSource trong UC47.

### GET /api/v1/rooms

Quyền MANAGER hoặc permission facility:manage, cùng cơ chế OR như room-types. Guard frontend không thay guard backend.

Query: search literal theo roomNumber không phân biệt hoa thường, tối đa 100 ký tự; roomTypeId ObjectId; status một trong bốn giá trị; isActive true/false, bỏ qua = tất cả; floor số nguyên; page >= 1 mặc định 1; limit 1–100 mặc định 10; sortBy roomNumber/floor/status, sortOrder asc/desc, mặc định roomNumber asc. DTO dùng pipe whitelist/forbidNonWhitelisted/transform hiện có; query lạ/sai trả 400 theo filter lỗi chuẩn.

Response `{ items, total, page, limit }`, item `{ id, roomNumber, floor, roomType: { id, name, isActive } | null, status, notes, isActive }`. Thiếu RoomType không làm sập danh sách: trả null và log cảnh báo chứa Room ID. Trả cả phòng inactive và loại phòng inactive, không tự sửa tham chiếu hoặc timestamps khi đọc.

Mongo collation `{ locale: 'en', numericOrdering: true }`, sort thêm `_id asc` làm tiêu chí phụ; count dùng cùng collation. Thứ tự số tự nhiên là **20 < 101 < 1010**, không phải thứ tự chuỗi 101 < 1010 < 20 trong ví dụ prompt. Không thay unique index bằng collation mới.

### Frontend

`features/rooms/`: api.ts, hooks.ts, routes.tsx, pages/RoomsPage.tsx. Route `/manager/rooms` ghép dưới PublicLayout hiện tại; menu Manager có “Phòng”. Một H1, bộ lọc tìm số phòng debounce 300ms, RoomType, trạng thái vận hành và hoạt động. Filter reset về trang 1; đổi trang giữ filter. API hỗ trợ floor nhưng UC47 chưa thêm bộ lọc tầng ngoài toolbar đã yêu cầu.

Bộ lọc RoomType tải tất cả trang API room-types hiện có (limit 100 mỗi lượt), gồm loại inactive có nhãn “ngừng”. Query options độc lập: lỗi tải loại phòng có thông báo/thử lại và khóa riêng dropdown đó, bảng và các filter khác vẫn hoạt động.

Bảng sáu cột: Số phòng, Tầng, Loại phòng, Trạng thái vận hành, Ghi chú, Hoạt động. Số căn phải; Badge tiếng Việt Trống/Có khách/Đang dọn/Bảo trì, nhãn Ngừng và Loại phòng ngừng. Ghi chú truncate, có title, aria-label đầy đủ và có thể focus. Có loading, lỗi/thử lại, rỗng chưa có phòng và rỗng do lọc. Bảng cuộn trong container trên 375px; component/token chung, không import icon hoặc mock production.

### Seed và thay đổi hành vi booking mẫu

Registry mới: **roles → users → amenities → room-types → rooms → bookings → feedback**.

Seed sáu phòng trên ba tầng: Standard 101 OCCUPIED / 102 AVAILABLE; Deluxe 201 CLEANING / 202 MAINTENANCE; Suite 301 AVAILABLE / 302 MAINTENANCE inactive. Có ghi chú ở các phòng cần giải thích. RoomType Suite vẫn inactive theo seed cũ và được hiển thị rõ trong danh sách.

Upsert theo roomNumber với `$setOnInsert`, không ghi đè chỉnh sửa. Riêng seed Room tắt auto timestamps trên update và đặt createdAt/updatedAt trong `$setOnInsert`, để chạy lại giữ nguyên cả timestamps của bản ghi đã có.

Trên DB mới, 101 là phòng active đầu tiên được chèn và đang OCCUPIED. seedBookings hiện tìm phòng active đầu tiên bằng collection rooms nên sau bổ sung seed Room sẽ tạo được `SEED-CHECKED-IN-001`, trạng thái CHECKED_IN, tham chiếu phòng 101; trước đây nó bỏ qua vì chưa có Room. Không sửa schema/logic/seed Booking hoặc Feedback. Với DB đã có phòng do người dùng chỉnh, seed vẫn giữ dữ liệu; lựa chọn active đầu tiên của seedBookings là hành vi hiện có, không tự chọn lại phòng hoặc ép trạng thái để ghi đè dữ liệu.

### Kiểm tra và bàn giao theo mẫu mục 15

- Ngày/baseline: 24/10/2026, main 7684a45. Đã kiểm tra lịch sử UC49, UC50 và hai nhánh fix trước khi triển khai.
- Baseline backend: lint/typecheck và 418 test pass. Baseline frontend: lint/typecheck và 108 test pass.
- Test riêng UC47: backend 30 unit, 17 e2e; frontend 13 test đều pass. Toàn repo và smoke ứng dụng thật được ghi kết quả cuối tại đây sau khi chạy xong.
- Lỗi phát hiện đã sửa trên nhánh fix: khai báo tường minh String cho enum và Schema.Types.ObjectId cho roomType; giữ timestamps của phòng khi seed lại. Không sửa module booking/availability/invoice/payment.
- Mỗi suite mới chỉ dọn Room/RoomType có prefix hoặc Room sample do chính suite tạo; không xóa collection module khác. DB test riêng, không dùng DB dev.
- Giả định: roomNumber trim, unique phân biệt hoa thường theo index binary; floor required là số nguyên an toàn, cho phép 0 và tầng âm, không thêm trần nghiệp vụ; isActive tách khỏi trạng thái vận hành; route/quyền như trên.
- H3 đủ schema Room/RoomStatus để Hiếu/Khoa dùng; adapter H6, flow check-in/out và CRUD Room vẫn thuộc task khác. Không có mock/TODO chặn UC47 trong production.
- Tài liệu tiến độ sau này tiếp tục ghi ở file này, không tạo file TIEN-DO-LAM theo từng UC. Context dự án riêng vẫn giữ để các prompt tiếp tục đọc.

### Kết quả cuối UC47 — 24/10/2026

| Kiểm tra | Kết quả thực chạy |
|---|---|
| Backend lint/format:check/typecheck/build | Pass |
| Backend unit toàn repo | 448/448 pass, 20 file |
| Backend e2e toàn repo | 95/95 pass, 15 file; DB riêng hms_task29_uc47_final_test, cổng 27030 |
| Frontend lint/format:check/typecheck/build | Pass; Vite còn cảnh báo bundle > 500kB |
| Frontend toàn bộ test | 121/121 pass, 12 file |
| npm run seed hai lần trên DB mới | Pass; DB riêng hms_task30_seed_test; đúng sáu phòng, đủ bốn trạng thái, một phòng inactive |
| Giữ chỉnh sửa sau seed lại | Pass; đã đổi floor/notes/updatedAt của 101 giữa hai lượt và kiểm tra toàn bộ dữ liệu Room giữ nguyên |
| Seed Booking sau khi có Rooms | Pass; SEED-CHECKED-IN-001 là CHECKED_IN, tham chiếu phòng 101 OCCUPIED |
| Swagger ứng dụng đã compile | GET /api/v1/rooms và response roomType nullable đúng schema |
| API + UI thật, Edge 375×812 | Pass; sáu dòng, đủ cột/nhãn, bộ lọc có Suite (ngừng), menu Phòng; document width = viewport = 375, vùng bảng 341px và bảng 850px cuộn nội bộ; đã xem ảnh |
| Git diff --check và liên kết tài liệu cũ | Pass; không còn tham chiếu tới ba file tiến độ đã gộp |
| Docker | Miễn theo yêu cầu trước của người dùng; không chạy/không tuyên bố pass |

Backend unit dùng `npm test -- --maxWorkers=1 --pool=threads --testTimeout=30000`; e2e dùng `npm run test:e2e -- --maxWorkers=1 --pool=threads --hookTimeout=60000 --testTimeout=30000 --no-cache`. No-cache tránh phụ thuộc thứ tự suite Seed/H5 đã ghi nhận trước đó; không sửa source/test booking/availability/invoices/payments. Frontend dùng `npm test -- --maxWorkers=1 --pool=forks --testTimeout=30000`.

Artifact local được ignore tại `.task29-validation/`: uc47-seed-result.json, uc47-seed-snapshot.json, uc47-live-result.json, uc47-live-mobile-375.png và các script kiểm tra. Smoke dùng API đã compile và MongoDB thật, không intercept hoặc mock dữ liệu production. Feedback seed tiếp tục chạy như trước; TODO liên kết booking thật của Feedback trong snapshot cũ không thuộc task này.

Xuất bản theo quy trình đã được người dùng cho phép: push feature/30-room-list và fix/30-room-status-schema, merge commit lần lượt vào main rồi pull main mới nhất. Không có gh CLI nên dùng Git trực tiếp, không tạo PR giả; tiêu đề chức năng tương ứng `feat(rooms): UC47 view room list (#30)`. Commit merge thực tế được xác nhận qua Git log/báo cáo cuối.

## Lịch sử bàn giao đã gộp

<a id="uc49"></a>
### UC49 — danh sách loại phòng

> Cập nhật 24/10/2026: xem [sửa sức chứa RoomType](TIEN-DO-LAM.md#capacity) cho adultCapacity/childCapacity, migration và trạng thái nhánh sửa. Các mô tả field capacity bên dưới là hợp đồng lịch sử UC49.

> Triển khai cho Trần Bảo Lâm từ main `9a0fb22`, nhánh `feature/28-room-type-list`.
> Code và kiểm tra cục bộ đã hoàn tất; lỗi format đã sửa, Docker được miễn theo yêu cầu. Xem cập nhật mới nhất ở cuối tài liệu.

> Xác nhận khi bắt đầu UC50 ngày 23/10/2026: UC49 đã merge main qua `4134194`. Bàn giao tiếp theo: [UC50 — tạo/sửa loại phòng](TIEN-DO-LAM.md#uc50). Các trạng thái “chưa merge” bên dưới là lịch sử trước thời điểm xuất bản UC49.

### Phạm vi

- Backend đọc danh sách RoomType thật từ MongoDB, có schema Amenity tối thiểu.
- Frontend `/manager/room-types`, menu Manager, phân quyền và các trạng thái dữ liệu.
- Không có thao tác thêm/sửa/xóa, schema Room/RoomStatus, adapter H6 hoặc thay đổi invoice.
- Header hiện có chỉ được cho phép xuống dòng ở màn hẹp để menu mới không ép chiều ngang; không tạo layout theo role.

### API

`GET /api/v1/room-types`, role MANAGER **hoặc** permission `facility:manage`.

Query:

| Field | Giá trị |
|---|---|
| search | Chuỗi tối đa 100 ký tự, tìm literal theo tên, không phân biệt hoa thường |
| isActive | true/false; bỏ qua = cả hai trạng thái |
| page | Số nguyên >= 1, mặc định 1 |
| limit | Số nguyên 1–100, mặc định 10 |
| sortBy | name/basePrice/capacity, mặc định name |
| sortOrder | asc/desc, mặc định asc |

Sort thêm `_id asc` làm tiêu chí phụ để phân trang ổn định khi giá trị bằng nhau.

Response `{ items, total, page, limit }`. Item gồm `id, name, description, capacity, basePrice, amenities: [{ id, name }], isActive, availableForBooking`.

`availableForBooking = isActive === true && capacity là số nguyên an toàn >= 1 && basePrice là số nguyên VND an toàn > 0`. Đây là trạng thái mở đặt của **loại phòng**, không phải phòng trống theo ngày. Không lưu field dẫn xuất.

Amenities đã bị xóa vật lý được Mongoose populate bỏ qua; tiện nghi inactive còn tồn tại vẫn xuất hiện để phản ánh thông tin đã ghi nhận. GET không thay đổi timestamp/dữ liệu hoặc tự sửa tham chiếu.

### Schema và module export

- `Amenity` / `AmenitySchema`: collection `amenities`; name required/trim/unique, description mặc định rỗng, isActive mặc định true, timestamps.
- `RoomType` / `RoomTypeSchema`: collection `roomtypes`; name required/trim/unique, description, capacity, basePrice, amenities ObjectId[] ref Amenity không trùng, isActive, timestamps.
- Unique name là index MongoDB, không phải validator Mongoose; không thêm unique không phân biệt hoa thường.
- `AmenitiesModule` export MongooseModule.
- `RoomTypesModule` export MongooseModule và RoomTypesService.
- Tên model/ref ổn định: `RoomType`, `Amenity`.
- Trong UC49 chỉ đọc, schema ref không tự bảo đảm tồn tại đối tượng tham chiếu khi một module khác ghi trực tiếp. Task #29 phải kiểm tra references hợp lệ ở service ghi dữ liệu.

### Seed

Thứ tự: `roles → users → amenities → room-types → bookings → feedback`.

- Amenity: Wi-Fi, Điều hòa, Bồn tắm.
- RoomType: Standard (850.000 VND, 2 khách), Deluxe (1.500.000 VND, 3 khách), Suite (2.800.000 VND, 4 khách, inactive).
- Upsert theo name với $setOnInsert, không ghi đè dữ liệu đã sửa.
- Không tạo Room giả để seed Booking. Seed Booking cũ vẫn bỏ qua nếu collection rooms chưa có Room active.
- Seed Feedback cũ giữ nguyên; task này không đổi tham chiếu booking của Feedback.

### Frontend

- Feature: `frontend/src/features/room-types/`.
- API qua client chung, query key `['room-types', query]`.
- Search debounce 300ms, thay search/status reset page về 1; chuyển trang giữ filter.
- Bảng hiển thị đủ 6 cột; tiền qua Intl vi-VN/VND, tiện nghi có chip và details khi > 3.
- Loading, lỗi + thử lại, chưa có dữ liệu và không khớp bộ lọc tách biệt.
- Route dùng RequireAuth cùng roles/permissions với backend.
- Bảng cuộn trong container, label và caption cho accessibility. Không có nút CRUD hoặc dữ liệu mock production.

### Kế thừa cho task sau

**#29/UC50:** tái sử dụng schema/module/API feature, bổ sung DTO/service/controller mutation và form; kiểm tra references Amenity, invalidation query room-types. Không cần tạo schema RoomType/Amenity thứ hai.

**#30–31 và H6:** import RoomTypesModule để dùng model. capacity nằm ở RoomType. Chưa có Room/RoomStatus; chưa có provider nguồn phòng thật cho H6. Việc nối availability và pricing thuộc prompt riêng, không coi UC49 là hoàn thành H3 toàn bộ.

**#32–33:** tái sử dụng Amenity schema và AmenitiesModule, quan hệ một chiều RoomType.amenities. Task này chưa có API Amenity.

### Quy ước Git người dùng yêu cầu từ task này

- Mỗi chức năng tạo nhánh từ main mới nhất: feature/<task>[-<task>]-<slug>.
- Lỗi phát sinh tạo nhánh fix/<task>-<slug> từ nhánh chức năng hoặc main nếu đã merge.
- Commit Conventional Commits nhỏ theo phạm vi.
- Làm xong nhánh nào thì push và merge ngay nhánh đó vào `main` bằng merge commit, áp dụng cho cả `feature/*` và `fix/*`. Áp dụng khi đủ scope và các check bắt buộc đã pass hoặc được người dùng miễn rõ ràng. Sau merge, pull `main` mới nhất rồi mới tạo nhánh feature hoặc fix tiếp theo. Fix tách từ feature chưa merge phải giữ thứ tự phụ thuộc: feature vào main trước, rồi tích hợp fix; không coi merge fix về feature là đã hoàn tất việc đưa thay đổi vào main. Đây là quy trình thường trực người dùng đã yêu cầu, không cần hỏi lại quyền push/merge khi đủ điều kiện.
- Chỉ push/PR/merge khi đủ scope và tất cả check bắt buộc pass. Merge commit, không force-push, không tự sửa Jira/nhánh người khác.
- Nếu baseline main đỏ: ghi rõ lỗi có sẵn, không sửa ngoài phạm vi. Không merge khi còn check đỏ hoặc chưa chạy.
- User đã cho phép push/PR/merge trong prompt #28 nhưng có điều kiện kiểm tra trên; không cần hỏi lại khi đã đủ điều kiện.

### Kết quả kiểm tra thực tế và trạng thái bàn giao (23/10/2026)

**Code đã hoàn thành cục bộ; chưa push, mở PR hoặc merge vào main.**

- Nhánh chức năng: `feature/28-room-type-list`.
- Nhánh sửa lỗi: `fix/28-room-type-tests`, đã merge cục bộ về feature bằng merge commit.
- Commit triển khai: `281be44`; format: `bb27ca4`; sửa test/menu: `e9bab49`; cô lập seed test: `94f5db5`.
- Merge fix vào feature cục bộ: `c1800cc`; chưa có PR/commit merge vào main.
- Main vẫn ở `9a0fb22`. Không thay đổi source hoặc test bookings/availability/invoices/payments.
- Môi trường: Node 24.18.0, npm 11.16.0, MongoDB cài máy 8.2, cổng test 27029.

#### Baseline main

Dependency ban đầu chưa có và lần cài trong sandbox gặp lỗi quyền; baseline không chạy được trước lúc viết code. Sau khi cài trong thư mục sạch, đã dựng checkout main nguyên vẹn tại cùng revision để đo baseline tách biệt, không dùng source UC49 làm baseline.

| Kiểm tra main | Kết quả |
|---|---|
| Backend lint | Pass |
| Backend typecheck | Pass |
| Backend format:check | Fail có sẵn: 24 file thuộc booking/invoice/payment và test liên quan |
| Backend unit | 129/130 pass ở lượt cold run; test Nest DI trong invoice-adapters.spec.ts timeout mặc định 5 giây |
| Backend e2e | 30/30 pass trên DB sạch hms_task28_baseline_e2e |
| Frontend lint/format/typecheck | Pass |
| Frontend test | 19/19 pass |
| Frontend build | Pass |

Lượt test mặc định đầu tiên bị timeout khởi động worker. Các lượt kiểm tra ổn định dùng một worker thread. Backend UC49 chạy toàn bộ 151 test, bao gồm test DI không chỉnh sửa nói trên, và pass khi cho timeout 30 giây; không sửa code invoice để xử lý vấn đề tốc độ máy.

#### Nhánh UC49 sau sửa lỗi

| Kiểm tra | Kết quả |
|---|---|
| Backend npm run lint | Pass |
| Backend npm run format:check | Fail đúng 24 file baseline, danh sách file đã đối chiếu trùng hoàn toàn |
| Prettier riêng mọi file backend UC49 và hai file đăng ký module/seed | Pass |
| Backend npm run typecheck | Pass |
| Backend npm test -- --maxWorkers=1 --pool=threads --testTimeout=30000 | 151/151 pass |
| Backend npm run test:e2e -- --maxWorkers=1 --pool=threads --hookTimeout=60000 --testTimeout=30000 | 43/43 pass, DB sạch hms_task28_feature_final |
| Backend npm run build | Pass |
| Frontend npm run lint | Pass |
| Frontend npm run format:check | Pass |
| Frontend npm run typecheck | Pass |
| Frontend npm test -- --maxWorkers=1 --pool=threads | 31/31 pass |
| Frontend npm run build | Pass |
| npm run seed | Pass trên DB hms_task28_smoke; seed booking bỏ qua vì chưa có Room, đúng hành vi cũ |
| Swagger ứng dụng thật | Có GET /api/v1/room-types và response/query schema |
| API + UI dữ liệu thật | 3 RoomType được hiển thị, đăng nhập bằng Manager mẫu |
| Edge headless 375 × 812 | Pass, document width = viewport = 375; bảng cuộn trong container, đã xem ảnh chụp |
| docker compose up --build | Chưa chạy: không có Docker CLI/executable được tìm thấy trên máy |

Artifact kiểm tra cục bộ được git-ignore trong `.task28-validation/`: log baseline/final, `smoke-result.json`, `uc49-mobile-375.png`. Đây không phải dependency hoặc tài nguyên production. Các server/profile/DB test riêng được dùng cho smoke test, không dùng DB dev.

#### Sửa lỗi đã thực hiện trên nhánh fix

- Assertion tiền VND dùng accessible cell matcher chấp nhận khoảng trắng không ngắt dòng do Intl tạo.
- Test phân trang chờ query hoàn tất trước khi bấm nút, tránh thao tác lúc đang loading.
- Menu thêm vùng chạm tối thiểu 44px.
- Test seed UC49 chỉ gọi seed Amenity/RoomType, không gọi seed toàn hệ thống để tạo User/Booking trước suite H5. Suite seed tổng sẵn có vẫn kiểm tra registry mới và pass trong toàn bộ e2e.

#### Phạm vi business rule của use case chỉ đọc

- BR-FAC-02: không tạo Room trong task này; quan hệ mỗi Room thuộc một RoomType phải được triển khai ở #30–31.
- BR-FAC-04: schema và availableForBooking kiểm tra capacity/giá, không thêm field availability lưu DB.
- BR-FAC-05: trả cả loại inactive và không có endpoint xóa.
- BR-FAC-06: response chỉ populate tiện nghi còn tồn tại; service ghi của #29 phải kiểm tra tồn tại/tham chiếu, không coi ref Mongoose là foreign key tự kiểm tra DB.

#### Điều kiện còn chặn xuất bản

1. Format toàn backend chưa xanh do 24 file baseline ngoài scope; chưa sửa theo yêu cầu người dùng.
2. Chưa kiểm tra Docker Compose. Chạy npm/MongoDB cục bộ không thay thế xác nhận container.
3. Vì hai điều kiện trên, chưa đủ gate để push/PR/merge main theo prompt. Không có mock/TODO chặn chức năng UC49.

Sau khi nhóm xử lý baseline và môi trường có Docker, chạy lại các check bắt buộc trong prompt, rồi kiểm tra:

```sh
docker compose up --build
docker compose exec backend npm run seed
```

Chỉ khi toàn bộ check xanh mới thực hiện:

```sh
git switch feature/28-room-type-list
git push -u origin feature/28-room-type-list
```

Tiêu đề PR đã chốt: `feat(room-types): UC49 view room type list (#28)`. Mở PR vào main, kiểm tra CI/review và merge bằng merge commit. Máy hiện không có gh CLI; có thể dùng giao diện GitHub hoặc cài gh khi đến bước xuất bản, không cần sửa code chức năng.

#### Task tiếp theo được mở khóa

- #29 UC50: có sẵn RoomType/Amenity schema, module export và UI/API list để thêm tạo/sửa.
- #32–33: có Amenity model và seed tối thiểu.
- H6: mới có phần RoomType; vẫn cần Room/RoomStatus và adapter nguồn phòng thật ở task riêng.
- H4 Service chưa được triển khai; không coi #28 là hoàn thành mọi hợp đồng cơ sở vật chất.

### Cập nhật mới nhất — sửa format và miễn Docker (23/10/2026)

Mục này thay thế các thông tin “còn chặn xuất bản” ở snapshot bàn giao trước.

- Người dùng đã cho phép sửa format cả phần backend kế thừa và **tạm bỏ qua Docker vì máy không cài được Docker**.
- Đã tạo nhánh `fix/28-backend-format`, commit `57e572e`, chỉ format 24 file qua Prettier rồi merge cục bộ về feature.
- Đã đối chiếu AST TypeScript trước/sau: cấu trúc tương đương khi bỏ trivia và ngoặc dư; không sửa logic nghiệp vụ.
- Backend `npm run format:check`, `lint`, `typecheck`, `build`: **pass**.
- Backend unit chạy lại: **151/151 pass**; e2e chạy lại trên DB sạch `hms_task28_format_final`: **43/43 pass**. Tham số một worker thread và timeout giữ như các lệnh ở bảng trên.
- Frontend không đổi trong lần sửa format; kết quả trước đó **31/31 test**, lint/format/typecheck/build pass vẫn áp dụng.
- Docker là **miễn kiểm tra theo yêu cầu người dùng**, không phải đã chạy/pass.
- Không còn blocker kiểm tra cục bộ của UC49 theo phạm vi đã điều chỉnh. Xuất bản tiếp theo quy trình Git được người dùng cho phép: push feature, merge commit vào main và push; máy không có gh CLI nên dùng phương án Git trực tiếp. Trạng thái remote và commit merge xác nhận qua báo cáo cuối/git log.

<a id="uc50"></a>
### UC50 — tạo/sửa loại phòng

> UC50 đã merge main tại e49794c. Cập nhật 24/10/2026: bản sửa [sức chứa người lớn/trẻ em](TIEN-DO-LAM.md#capacity) đang thay capacity bằng adultCapacity/childCapacity trên nhánh fix/28-room-type-capacity; xem tài liệu mới cho migration, check và blocker. Các hợp đồng capacity bên dưới được giữ làm lịch sử.

Ngày: 23/10/2026. Baseline `main` đã pull tới `4213c8d`; UC49 đã merge qua `4134194`. Nhánh triển khai `feature/29-room-type-form`, commit triển khai `78821b7`; sửa kiểm thử trên `fix/29-form-validation-tests`, commit `99c3d21`, đã tích hợp về feature cục bộ. Chưa có PR/commit merge main cho UC50.

### Đã triển khai

- Kế thừa schema RoomType/Amenity của #28, giữ tên giá `basePrice`, không thêm schema/enum hoặc endpoint DELETE.
- API tạo, đọc chi tiết, cập nhật từng phần và chọn tiện nghi thật từ MongoDB. Quyền MANAGER hoặc `facility:manage`, giống UC49, dùng guard hiện có.
- Form dùng chung tạo/sửa trong native `<dialog>`, giữ nguyên state tìm kiếm, bộ lọc và trang của danh sách. Native dialog giữ focus, hỗ trợ Esc, trả focus về nút mở; chặn đóng khi đang gửi.
- Tên, mô tả, sức chứa, giá VND, tiện nghi và trạng thái; giá hiển thị vi-VN, gửi số nguyên. Tiện nghi đã gắn nhưng inactive hiển thị “ngừng” và có thể bỏ. Có loading/lỗi/thử lại/rỗng cho tiện nghi.
- Lỗi field liên kết aria-describedby, focus lỗi đầu tiên, gắn 409 trùng tên và lỗi tiện nghi vào đúng trường; giữ dữ liệu khi lỗi. Chống double submit, loading/disabled và thông báo thành công sau khi invalidate danh sách/chi tiết.
- Ngừng nhận đặt phòng là hành động riêng, có xác nhận, chỉ gửi PATCH `{ isActive: false }`. Giữ nguyên bản ghi và tham chiếu; không viết hoặc giả lập kiểm tra reservation.

### API / DTO

| Endpoint | Kết quả |
|---|---|
| POST `/api/v1/room-types` | 201, RoomType đầy đủ với amenities populate |
| GET `/api/v1/room-types/:id` | Chi tiết dùng cho form, amenities thêm `isActive` |
| PATCH `/api/v1/room-types/:id` | 200, chỉ cập nhật field được gửi; hỗ trợ ngừng/kích hoạt lại |
| GET `/api/v1/amenities/options` | `[{ id, name }]`, chỉ active, sort name rồi `_id` |

`CreateRoomTypeDto`: name trim, bắt buộc, tối đa 100 ký tự; description tùy chọn/trim; capacity số nguyên an toàn >= 1; basePrice số nguyên an toàn VND > 0; amenities tùy chọn, mặc định [], ObjectId canonical lowercase không trùng; isActive tùy chọn, mặc định true. Không nhận null hoặc số dạng chuỗi. PATCH dùng DTO partial không có default; body rỗng, field lạ, `_id`/timestamps bị từ chối.

Lỗi theo filter toàn cục `{ statusCode, message, error, path, timestamp }`. Swagger khai báo request/response và các mã lỗi trên từng endpoint. Item chi tiết/tạo/sửa giữ các field của UC49; `amenities[].isActive` là metadata bổ sung cho editor, đã khai báo optional trong response DTO. GET list giữ hợp đồng cũ.

Tên unique theo index hiện có, phân biệt hoa thường; kiểm tra trước và bắt E11000 cả create/update để trả 409. Không thêm collation. Service kiểm tra tiện nghi gắn mới phải tồn tại và active; các ID đang gắn được giữ lại. Kiểm tra toàn bộ trước ghi, không lưu một phần nếu có tiện nghi sai.

PATCH dùng atomic findOneAndUpdate, runValidators và trả bản ghi sau sửa. Điều kiện ghi đối chiếu snapshot capacity/basePrice/isActive/amenities để không dùng trạng thái đã cũ khi kiểm tra; thử lại tối đa 5 lần rồi báo 409. `$set` chỉ chứa field Manager gửi. Bật active kiểm tra capacity và validBasePrice (dùng isMoneyVnd); dữ liệu legacy không hợp lệ vẫn có thể ngừng. `availableForBooking` tiếp tục dẫn xuất, không lưu DB.

### Hợp đồng bàn giao — mẫu mục 15

- **Task/phạm vi:** #29 UC50, backend/frontend/test; Amenity chỉ có endpoint options và provider validate, chưa phải CRUD #32–33.
- **Provider:** RoomTypesModule tiếp tục export RoomTypesService và MongooseModule. `RoomTypesService.create(CreateRoomTypeDto)`, `detail(id)`, `update(id, UpdateRoomTypeDto)`, `list(query)`. AmenitiesModule export AmenitiesService và MongooseModule; `validateNew(ids, retainedIds?)`, `options()`.
- **Route:** giữ `/manager/room-types`, thêm hộp thoại tại trang đó; không cần route tạo/sửa riêng hoặc thay router/layout chung.
- **Seed/thứ tự:** không đổi `roles → users → amenities → room-types → bookings → feedback`; seed vẫn `$setOnInsert`. Không đổi seed booking hoặc nguồn giá invoice.
- **#31 Room:** import RoomTypesModule khi cần model/service; mỗi Room tham chiếu đúng một RoomType theo task #31. Không dùng `availableForBooking` để suy ra phòng trống theo ngày.
- **H6:** RoomType cung cấp capacity, basePrice/isActive và trạng thái hợp lệ; adapter nguồn phòng thật vẫn thuộc task riêng. Không thay thuật toán booking/availability hoặc nguồn giá lịch sử H7.
- **Giả định:** tên tối đa 100 ký tự; giá VND > 0 và capacity >= 1, chỉ có trần kỹ thuật Number.MAX_SAFE_INTEGER; giữ unique phân biệt hoa thường của schema. Không thêm business rule chặn sửa giá theo booking.
- **Mock/TODO production:** không có mock hoặc TODO chặn UC50; fixture chỉ nằm trong test. Module Task trên baseline chặn chạy ứng dụng Node/seed, xem bên dưới.
- **Task mở khóa:** #31 có service tạo/sửa RoomType, #32–33 có options/validation provider để mở rộng. H3 Room/H6 adapter chưa được triển khai bởi UC50.

### Kiểm tra thực chạy

| Kiểm tra | Kết quả |
|---|---|
| Baseline backend lint/typecheck/unit | Pass; 290/290 test, một worker thread, testTimeout 30000 |
| Baseline frontend lint/typecheck | Pass |
| Baseline frontend unit | 31 test pass nhưng 2 suite Task/Staff Dashboard không khởi động worker threads; lượt này không pass |
| Backend lint/format:check/typecheck | Pass |
| Backend unit | 322/322 pass, 18 file; `npm test -- --maxWorkers=1 --pool=threads --testTimeout=30000` |
| Backend toàn bộ e2e | 53/53 pass, 12 file; MongoDB riêng cổng 27030, DB `hms_task29_final_test` |
| UC50 e2e sau bổ sung kiểm tra seed/legacy | 7/7 pass trên DB `hms_task29_extra_test`, gồm Manager sửa dữ liệu rồi seed lại và ngừng bản ghi legacy không hợp lệ |
| Frontend toàn bộ unit | 99/99 pass, 11 file; `npm test -- --maxWorkers=1 --pool=forks --testTimeout=30000` |
| Backend build | Pass sau khi di chuyển dist cũ trong workspace và build sạch; các lượt trước gặp EPERM unlink |
| Frontend lint/format:check/typecheck/build | Pass ở lượt cuối sau sửa test; Vite cảnh báo bundle >500kB |
| Swagger | Test tạo document từ AppModule thật, đủ POST/GET detail/PATCH và amenities/options |
| Edge headless 375×812 | Pass: document width 375; dialog rộng 343, x=16; focus trap, Esc, trả focus, tải form sửa; đã xem ảnh |
| npm run seed | Fail trên feature và checkout main sạch cùng revision: Task import Connection từ mongoose |
| Docker | Miễn kiểm tra theo yêu cầu người dùng; không chạy hoặc tuyên bố pass |

Backend e2e dùng `--maxWorkers=1 --pool=threads --hookTimeout=60000 --testTimeout=30000`. Cleanup suite UC50 chỉ xóa RoomType/Amenity có prefix của suite; DB test riêng, không dùng DB dev hoặc xóa collection module khác. Test kiểm tra auth, bốn role bị chặn, write API, partial update, inactive retention, rejected write không đổi dữ liệu, trạng thái, ID, lỗi body, DELETE không tồn tại và Swagger.

Lượt frontend thử `--no-isolate` gây ảnh hưởng mock giữa các suite nên đã dừng và không dùng làm bằng chứng pass; không sửa Task/Staff Dashboard để ép test xanh. Lượt cuối dùng forks có isolation như bảng trên.

Artifact local được ignore tại `.task29-validation/`: MongoDB riêng, checkout main baseline, script kiểm tra trình duyệt, `browser-result.json`, ảnh `uc50-mobile-375.png`. Kiểm tra trình duyệt dùng CDP fixture ở tầng API, không phải UI nối backend Node thật. API/DB thật được kiểm tra bằng Nest e2e trong Vitest; Vitest transform không phát hiện lỗi ESM runtime dưới đây.

### Blocker và trạng thái xuất bản

`npm run seed` trên cả feature và checkout main nguyên vẹn `4213c8d` thất bại trước khi kết nối DB:

```text
backend/src/modules/tasks/tasks.service.ts:10
import { Connection, Model, Types } from 'mongoose';
SyntaxError: The requested module 'mongoose' does not provide an export named 'Connection'
```

Đã đối chiếu diff module Task với main: không thay đổi. Không sửa ngoài phạm vi UC50 theo yêu cầu. Hướng xử lý cho chủ module Task: tách Connection sang type-only import rồi kiểm tra lại metadata DI, ứng dụng Node và seed. Unit/e2e xanh không thay thế kiểm tra ứng dụng đã compile.

**Chưa push, chưa mở PR hoặc merge main** vì seed chưa xanh và chưa kiểm tra UI + Swagger qua ứng dụng Node thật. Docker được miễn, không phải blocker. Sau khi lỗi Task trên main được xử lý: cập nhật main vào feature, chạy lại checks bắt buộc, seed trên DB riêng và smoke UI/Swagger thật; chỉ xuất bản khi đủ điều kiện người dùng đã đặt.

Lệnh còn lại sau khi các gate pass:

```sh
git push -u origin feature/29-room-type-form
gh pr create --base main --head feature/29-room-type-form --title "feat(room-types): UC50 create/update room type (#29)" --body-file <file-noi-dung-PR>
gh pr merge --merge <PR>
```

Nếu không có gh, dùng phương án Git merge commit đã được người dùng cho phép, sau khi kiểm tra quyền và trạng thái remote; không force-push hoặc sửa Jira.

### Cập nhật xuất bản theo yêu cầu mới

Backend `npm run typecheck` sau khi đồng bộ main: pass. Chưa chạy lại toàn bộ test sau lần đồng bộ này.

Người dùng đã yêu cầu push UC50 dù lỗi seed thuộc module Task, sau đó lấy các phần mới từ main. Đã push `feature/29-room-type-form`, fetch main tới `f9dcb4a` và merge vào feature bằng commit `e5a44c8`, không có conflict. Main mới bổ sung nền tảng VNPay, settlement và payment endpoints; không phải thay đổi UC50. Thông tin “chưa push” phía trên là snapshot trước yêu cầu này. Chưa mở PR hoặc merge UC50 vào main; kết quả unit/e2e phía trên được đo trước lần cập nhật main này.

<a id="capacity"></a>
### Sửa sức chứa và lỗi runtime Task

> Cập nhật sau kiểm tra ban đầu: người dùng đã cho phép sửa lỗi runtime Task. Nhánh `fix/64-task-connection-import`, commit `7ff5996`, đổi Connection sang type-only import; npm run seed toàn ứng dụng đã pass hai lần và ứng dụng Node/Swagger/API/UI thật đã khởi động thành công. Xem mục cập nhật cuối tài liệu; các blocker seed ghi bên dưới là kết quả lịch sử trước bản sửa import.

Ngày 24/10/2026. Nhánh `fix/28-room-type-capacity`, từ main `e49794c` sau khi pull; đã xác nhận UC49 (`4134194`) và UC50 (`e49794c`) có trong lịch sử main. Đây là sửa lệch ERD theo yêu cầu người dùng, không phải mở rộng H6 hoặc Booking.

### Hợp đồng mới

- RoomType thay `capacity` bằng **adultCapacity** (số nguyên an toàn >= 1) và **childCapacity** (số nguyên an toàn >= 0). Cả hai bắt buộc khi tạo; PATCH vẫn từng phần. ChildCapacity = 0 hợp lệ.
- Các giới hạn >= 1 / >= 0 là **giả định được yêu cầu trong prompt**, chưa phải business rule được nhóm duyệt; SRS chỉ nói “valid capacity”. Không thêm trần nghiệp vụ ngoài giới hạn số nguyên an toàn của JavaScript.
- GET list/detail, POST/PATCH response và Swagger dùng hai field mới, không trả field tổng hoặc `capacity`. POST/PATCH gửi field cũ trả 400 qua forbidNonWhitelisted.
- Sort chấp nhận `name | basePrice | adultCapacity | childCapacity`, vẫn thêm `_id asc` để phân trang ổn định; `sortBy=capacity` trả 400.
- `availableForBooking = isActive === true && validAdultCapacity(adultCapacity) && validChildCapacity(childCapacity) && validBasePrice(basePrice)`. Tạo active, kích hoạt lại và sửa dữ liệu active đều kiểm tra trạng thái sau cập nhật. Không lưu giá trị dẫn xuất.
- Atomic PATCH đối chiếu snapshot cả hai field mới cùng basePrice/isActive/amenities; `$set` chỉ chứa field đã gửi, bật runValidators và trả dữ liệu sau ghi.
- Giá, tên unique phân biệt hoa thường, xử lý E11000/409, tiện nghi active/retained, soft deactivate, quyền Manager hoặc facility:manage và việc không có DELETE được giữ nguyên.

Frontend thay cột sức chứa thành **Người lớn** và **Trẻ em**, căn phải; bảng vẫn cuộn ngang trong container ở mobile. Form dùng hai ô number có min/step, validation client riêng, aria-describedby và focus lỗi. Lỗi backend chứa adultCapacity/childCapacity được gắn vào đúng ô. Không đổi modal, xác nhận ngừng, filter, phân trang, thông báo/invalidation hoặc xử lý tiện nghi.

### Migration và seed

`backend/src/modules/room-types/migrate-capacities.ts` export `migrateRoomTypeCapacities(model)`, được gọi đầu `seedRoomTypes`, trước seed mẫu.

Native MongoDB collection update pipeline chỉ khớp document có `capacity` và **chưa có cả adultCapacity lẫn childCapacity**:

1. Gán adultCapacity bằng nguyên giá trị capacity cũ, childCapacity = 0.
2. Gỡ capacity trong cùng atomic update của document.

Không đổi `_id`, timestamps, tên, mô tả, giá, trạng thái hoặc tiện nghi; không ghi đè dữ liệu đã có field mới. Chạy lại không đổi bản ghi đã chuyển. Dùng collection trực tiếp để đọc field legacy đã bị gỡ khỏi Mongoose schema và tránh cập nhật timestamp khi chỉ chuyển cấu trúc.

Document đã có một field mới nhưng thiếu field còn lại được giữ nguyên để tránh ghi đè dữ liệu chuyển dở; cần kiểm tra/chỉnh rõ ràng nếu gặp. Dữ liệu legacy có capacity không hợp lệ được giữ nguyên giá trị khi chuyển; không tự đoán hoặc sửa số, và availableForBooking sẽ false cho tới khi hợp lệ. Chạy migration trước khi sử dụng hợp đồng API mới với dữ liệu legacy.

Mẫu **mới được insert**: Standard 2/1, Deluxe 2/0, Suite 4/2 (người lớn/trẻ em). Seed mẫu vẫn `$setOnInsert`, không ép dữ liệu Standard/Deluxe/Suite đã chỉnh theo giá trị mẫu. Bản ghi Standard legacy capacity=2 chuyển thành 2/0, không bị seed đổi thành 2/1.

### Kiểm tra thực chạy

| Kiểm tra | Kết quả |
|---|---|
| Baseline main backend lint/typecheck/unit | Pass; 400/400 test |
| Baseline main frontend lint/typecheck/unit | Pass; 99/99 test |
| Backend lint/format:check/typecheck | Pass |
| Backend unit | 418/418 pass, 19 file |
| Backend e2e | 78/78 pass, 14 file; DB riêng `hms_task29_capacity_final_test`, cổng 27030 |
| Backend build | Pass |
| Frontend lint/format:check/typecheck | Pass |
| Frontend test | 108/108 pass, 11 file |
| Frontend build | Pass; cảnh báo kích thước bundle Vite > 500kB |
| Swagger | E2e tạo document AppModule thật, xác nhận response có hai field mới và không có capacity; DTO đã cập nhật |
| Seed tiện nghi/loại phòng đã compile | Pass hai lần trên DB `hms_task29_capacity_seed_test`, có dữ liệu legacy và document mới đã sửa; migration 3 -> 3/0, timestamps giữ nguyên, không ghi đè hoặc nhân bản mẫu |
| npm run seed toàn ứng dụng, lần 1 và 2 | Cả hai fail: Task import Connection từ mongoose, trước bước seed |
| Edge headless 375×812 | Pass: document width 375, dialog rộng 343; đủ hai cột, form sửa tải 2 người lớn/0 trẻ em, focus trap/Esc/return focus pass; đã xem ảnh |
| docker compose up --build | Không chạy được vì máy không có Docker CLI; không báo pass |
| git diff --check | Pass |

Lệnh backend unit: `npm test -- --maxWorkers=1 --pool=threads --testTimeout=30000`.

Lệnh backend e2e: `npm run test:e2e -- --maxWorkers=1 --pool=threads --hookTimeout=60000 --testTimeout=30000`, NODE_ENV=test và MONGODB_URI chỉ tới DB test riêng.

Lệnh frontend: `npm test -- --maxWorkers=1 --pool=forks --testTimeout=30000`.

Không xóa hoặc bỏ test UC49/UC50; cập nhật fixture/assertion và bổ sung trường hợp người lớn/trẻ em thiếu/âm/thập phân/0, từ chối field/sort cũ, partial PATCH giữ field còn lại, availability, sort hai field, migration idempotent và không ghi đè document mới hoặc chuyển dở. Toàn bộ test booking/availability/invoice/payment vẫn được chạy và pass; source/test của các module đó không đổi.

Artifact local trong thư mục đã ignore `.task29-validation/`: `capacity-seed-smoke.mjs`, `capacity-seed-result.json`, `capacity-browser-smoke.mjs`, `capacity-browser-result.json`, `capacity-mobile-375.png`. Seed smoke dùng **hàm seed production đã compile** với test harness chỉ cung cấp model qua getModelToken; không tương đương `npm run seed` toàn ứng dụng. Browser smoke dùng fixture tại tầng API; Nest e2e dùng MongoDB thật. Không có mock thêm vào production.

### Phần H6 còn dùng capacity — bàn giao Hiếu

Không sửa `AvailabilityRoomSource` hoặc ánh xạ adult/child sang guests. Production còn `capacity` tại:

- `backend/src/modules/bookings/availability.core.ts:18`: field capacity của candidate/available room.
- `backend/src/modules/bookings/availability.core.ts:133`: kiểm tra số nguyên an toàn.
- `backend/src/modules/bookings/availability.core.ts:134`: so sánh capacity với query.guests.
- `backend/src/modules/bookings/availability.core.ts:139`: trả projection id/roomTypeId/capacity.

Fixture/assertion H6 còn dùng capacity trong `availability.core.spec.ts`, `availability.service.spec.ts` và `backend/test/availability.e2e-spec.ts`. Tài liệu `docs/H6-AVAILABILITY.md`, các snapshot context và `docs/TIEN-DO-HIEU.md` cũng còn mô tả hợp đồng H6 cũ. Không tự sửa các phần thuộc Hiếu.

Grep toàn repository xác nhận room-types/amenities không dùng capacity trong hợp đồng hiện hành; các chỗ còn lại của room-types là migration hoặc test từ chối field cũ/fixture legacy. Tài liệu UC49/UC50 cũ được giữ làm lịch sử và có link tới hợp đồng mới này.

### Cập nhật context theo mẫu mục 15

- **Ngày/revision:** 24/10/2026, baseline main e49794c; branch fix/28-room-type-capacity. Chưa có PR/merge main cho bản sửa này.
- **Phạm vi:** schema/DTO/service/seed/API/types/table/form/test RoomType; không đổi Room, Booking/H6, Amenity/Service, layout hoặc thanh toán.
- **Provider/API:** giữ RoomTypesModule và RoomTypesService create/detail/update/list; payload/response dùng adultCapacity/childCapacity. Amenities options/validation giữ nguyên.
- **Module khác dùng:** đọc hai field riêng; ánh xạ sang H6 do Hiếu quyết định, không tự cộng thành tổng trong response hoặc sửa hợp đồng H6.
- **Seed:** thứ tự registry không đổi; migration chạy đầu seedRoomTypes, mẫu mới dùng hai field, dữ liệu đã sửa không ghi đè.
- **Checks:** bảng kết quả thực chạy ở trên; phân biệt seed module pass với seed ứng dụng fail.
- **Giới hạn:** npm run seed bị lỗi runtime Task có sẵn; Docker CLI không có. Không sửa việc ngoài scope và không đánh dấu các check đó pass.
- **Task tiếp theo:** Room #30–31 phải dùng hai field sức chứa mới; H6 adapter vẫn cần thống nhất riêng. Đây không phải triển khai H6/Booking AdultCount/ChildCount.

### Trạng thái xuất bản

`npm run seed` cả hai lần báo:

```text
backend/src/modules/tasks/tasks.service.ts:10
import { Connection, Model, Types } from 'mongoose';
SyntaxError: The requested module 'mongoose' does not provide an export named 'Connection'
```

Module Task không có diff so với main; lỗi này đã được tái hiện trên main sạch ở lần bàn giao UC50 trước. Chưa push/mở PR/merge bản sửa sức chứa, vì prompt mới yêu cầu không xuất bản khi check bắt buộc còn đỏ/chưa chạy. Quyết định miễn blocker khi merge UC50 trước đó không tự được coi là miễn cho task sửa sức chứa mới.

Sau khi xử lý hoặc có miễn kiểm tra rõ ràng cho blocker: cập nhật main, chạy lại check cần thiết rồi push/PR/merge commit theo quy trình. Tiêu đề PR đã yêu cầu: `fix(room-types): split capacity into adult/child (#28, #29)`.

### Cập nhật sửa lỗi runtime Task — 24/10/2026

Người dùng đã yêu cầu sửa luôn lỗi import. `TasksService` đổi `import { Connection, Model, Types }` thành `import { Model, Types, type Connection }`. Connection không còn bị import như giá trị ESM; `@InjectConnection()` vẫn dùng token Mongoose đã khai báo tường minh. Không sửa business logic Task/Booking.

- Backend lint, format:check, typecheck và build sau sửa: pass.
- Backend unit sau sửa: 418/418 pass.
- `npm run seed` toàn ứng dụng: **hai lần đều pass** trên DB riêng `hms_task29_capacity_fixed_seed_test`. Đã chuẩn bị document legacy và document mới đã chỉnh trước khi chạy; sau mỗi lượt kiểm tra migration 3 -> 3/0, giá/mô tả/timestamps cũ giữ nguyên, bản ghi mới 7/2 không bị ghi đè, mỗi mẫu có đúng một bản ghi.
- Node chạy `dist/main.js` thành công; smoke HTTP thật xác nhận Swagger dùng adultCapacity/childCapacity, từ chối field capacity cũ, list seed đúng, POST 201 và partial PATCH 200 giữ field còn lại.
- Edge 375×812 nối API đã compile và MongoDB thật: pass; Standard tải đúng 2 người lớn/1 trẻ em và tiện nghi seed. Không dùng API fixture cho lượt này. Focus trap/Esc/return focus pass, document width 375, dialog width 343; đã xem ảnh `.task29-validation/capacity-live-mobile-375.png`.
- Frontend không đổi trong bản sửa import; kết quả 108 test và lint/format/typecheck/build đã pass ở lượt sửa sức chứa vẫn áp dụng.
- Docker tiếp tục được miễn theo yêu cầu trước của người dùng; không tuyên bố đã chạy/pass container.

Lượt e2e đầu sau sửa có 77/78 pass: suite Seed để lại customer@hms.local trong DB dùng chung, làm H5 (kỳ vọng chưa có customer mẫu) thất bại khi thứ tự chạy dựa vào cache thay đổi. Không sửa source/test Booking để che lỗi; chạy lại toàn bộ trên DB mới với `--no-cache`. Kết quả lượt cuối và merge được ghi theo kiểm tra thực tế, không coi lượt 77/78 là pass.

Lượt cuối: **78/78 e2e pass, 14 file**, trên DB mới `hms_task29_connection_nocache_test`, lệnh `npm run test:e2e -- --maxWorkers=1 --pool=threads --hookTimeout=60000 --testTimeout=30000 --no-cache`. Tất cả kiểm tra ứng dụng yêu cầu đã pass; Docker giữ miễn kiểm tra theo yêu cầu người dùng trước đó. Quy trình xuất bản dùng merge commit lần lượt `fix/28-room-type-capacity` rồi `fix/64-task-connection-import` (nhánh sau chứa bản sửa trước); không có gh CLI nên dùng Git trực tiếp như đã được cho phép. Lịch sử Git và báo cáo cuối xác nhận commit merge thực tế; các dòng “chưa push/merge” phía trên là snapshot trước khi sửa blocker.

## Sửa CI e2e — 24/10/2026

- Run GitHub Actions 39999694245: frontend pass; backend lint/format/typecheck và 448 unit tests pass, nhưng e2e UC50 dừng vì guard chỉ nhận database `hms_task29_*test`, trong khi workflow dùng `hms_test` (16 test bị skip).
- Thay guard đặc thù task bằng `assertTestDatabase`: kiểm tra protocol MongoDB và chính tên database theo mẫu `hms_*test`, nhận `hms_test` của CI. Không kiểm tra substring toàn URI; host, credentials hoặc query chứa tên test không thể vượt guard. URI lỗi không bị đưa vào thông báo để tránh lộ thông tin đăng nhập.
- Bổ sung 12 ca kiểm thử guard, gồm database CI/task hợp lệ và database development/production/backup, protocol sai, URI thiếu/sai. Không bỏ qua test hay thay đổi workflow Docker; Docker cục bộ vẫn được miễn theo yêu cầu.
- Xác minh cục bộ: backend lint, format, typecheck, build pass; 460/460 unit tests pass. Chạy đúng lệnh e2e mặc định với database `hms_test` trên MongoDB cục bộ pass 95/95. Không chạy Docker cục bộ.

<a id="uc48"></a>
## #31 — UC48 Create / Update Room và bàn giao H3 hoàn chỉnh

Ngày: 24/10/2026. Baseline main `7d41711` đã có #28/#29/#30 và adapter availability/pricing của Hiếu; đã đọc code và git history thay vì dùng snapshot cũ. Nhánh `feature/31-room-form`: `bbcead4` (API/DTO/service/tests), `2000da3` (form/hành động/tests). Nhánh `fix/31-room-form-focus`: `0dd23dd` sửa focus modal, tích hợp main định dạng tại `4f12359`.

### Phạm vi và API

- Giữ nguyên schema `Room`, collection `rooms`, enum `RoomStatus` bốn giá trị AVAILABLE/OCCUPIED/CLEANING/MAINTENANCE; không thêm field, không thêm DELETE.
- `POST /api/v1/rooms` → 201; `GET /api/v1/rooms/:id` → 200; `PATCH /api/v1/rooms/:id` → 200. Cùng response công khai như list: id, roomNumber, floor, roomType `{ id, name, isActive } | null`, status, notes, isActive.
- `CreateRoomDto`: roomNumber string bắt buộc/trim/không rỗng; floor bắt buộc là số nguyên an toàn (cho phép âm/0, không thêm giới hạn tầng); roomType bắt buộc ObjectId canonical lowercase; status tùy chọn mặc định AVAILABLE; notes tùy chọn/trim mặc định rỗng; isActive boolean tùy chọn mặc định true. DTO không nhận null, mảng, field lạ, _id/timestamps. `UpdateRoomDto` partial, tối thiểu một field; body rỗng → 400.
- `GET /api/v1/room-types/options` → tất cả `{ id, name }` có isActive=true, sort name rồi _id, không phân trang/không giới hạn 100; khai báo trước route `:id`. Bộ lọc UC47 vẫn lấy mọi loại phòng gồm inactive theo các trang list cũ; form lấy options active riêng.
- Tất cả endpoint quản lý dùng `@Roles(Role.Manager)` OR `@Permissions('facility:manage')`, kế thừa guard toàn cục. FE tiếp tục RequireAuth cùng điều kiện. Lỗi theo filter chuẩn `{ statusCode, message, error, path, timestamp }`; Swagger có DTO/response và 400/401/403/404/409 phù hợp.

### Quy tắc service và điểm nối cho module khác

`RoomsModule` tiếp tục export `RoomsService` và MongooseModule; module khác import RoomsModule, inject RoomsService hoặc model qua `getModelToken(Room.name)`. RoomType model lấy từ RoomTypesModule có sẵn, không tạo schema/provider thay thế.

- `RoomsService.create(dto: CreateRoomDto)`: cần ít nhất một RoomType active, loại được chọn phải tồn tại/active; kiểm tra trùng roomNumber và bắt E11000 từ unique index → 409 “Số phòng đã tồn tại”. Unique giữ nguyên **phân biệt hoa thường**, không thêm collation vào index/query kiểm tra trùng.
- `RoomsService.detail(id)` kiểm tra canonical ObjectId → 400; phòng không tồn tại → 404; trả cùng projection như list, chịu được missing RoomType.
- `RoomsService.update(id, dto: UpdateRoomDto)`: chỉ `$set` field được gửi, `findOneAndUpdate` với `runValidators: true`, `returnDocument: 'after'`. So sánh snapshot roomType/isActive trong filter atomic, đọc lại và kiểm tra lại nếu có writer Room xen kẽ, tối đa 5 lượt; contention → 409 yêu cầu thử lại. Không ghi đè các field không gửi.
- Đổi sang RoomType khác yêu cầu loại mới active. Chỉ sửa roomNumber/floor/notes/status, hoặc ngừng phòng với loại hiện tại đã inactive, vẫn được phép. Kích hoạt false → true yêu cầu loại hiện tại còn active hoặc gửi cùng roomType mới active trong PATCH đó; sai → 400, không lưu thay đổi nào.
- BR-FAC-05: vô hiệu hóa chỉ `isActive=false`, idempotent 200; giữ bản ghi, ID và các tham chiếu Booking.rooms/RoomHold/Equipment. Không query, sửa hoặc xóa Booking/Invoice/availability trong RoomsService, không chặn vì phòng đang có reservation. Không có endpoint/hành động xóa vật lý.
- Manager được đổi tự do giữa cả 4 trạng thái; không thêm ma trận chuyển trạng thái, không chặn đổi loại vì booking. **Cần báo Hiếu:** đổi RoomType của phòng có booking có thể ảnh hưởng H7 đang lấy giá RoomType hiện tại; UC48 không tạo snapshot giá hoặc sửa pricing.
- Kiểm tra loại phòng là snapshot read trước write Room, không phải transaction xuyên RoomType/Room; không tuyên bố giải quyết race khi module khác ngừng RoomType đồng thời.

Hợp đồng dữ liệu cho adapter H6:

| Field adapter | Nguồn H3 |
|---|---|
| id | String(Room._id), tương ứng id trong response |
| roomTypeId | String(Room.roomType), tương ứng response.roomType.id khi còn ref |
| isActive | Room.isActive; false nghĩa không nhận đặt mới |
| status | Room.status, enum RoomStatus dùng chung |
| roomTypeActive | RoomType được populate tồn tại và isActive=true; thiếu ref → false |

Adapter thật hiện đã ở main do Hiếu viết (`MongoAvailabilityRoomSource`), lọc Room.isActive và đọc RoomType; UC48 không sửa adapter, thuật toán availability hoặc chính sách operationallyAvailable. Không dùng snapshot H6 cũ để ghi đè ánh xạ của Hiếu.

### Frontend

- Mở rộng `/manager/rooms` hiện có: Thêm phòng, Sửa mỗi dòng; modal `RoomEditor`/`RoomForm` theo mẫu UC50 (native dialog, tải chi tiết trước khi sửa, loading/error/retry). Thiếu RoomType active thì khóa thêm và có liên kết `/manager/room-types`; lỗi/tải options không làm hỏng bảng/bộ lọc.
- Form đủ số phòng, tầng, loại phòng, bốn nhãn Trống/Có khách/Đang dọn/Bảo trì, textarea ghi chú và hoạt động. ROOM_STATUSES/ROOM_STATUS_DISPLAY dùng chung với bảng; test đọc enum BE để đối chiếu đủ 4 giá trị. Hiển thị loại hiện tại đã ngừng, cho sửa thông tin khác và buộc đổi loại khi bật lại.
- Hành động Ngừng nhận đặt phòng/Kích hoạt lại phòng có xác nhận riêng; đổi checkbox hoạt động khi lưu cũng xác nhận. Ngừng riêng chỉ PATCH isActive=false, không bị chặn bởi dữ liệu nháp chưa hợp lệ. Nội dung nêu phòng được giữ lại, reservation đang hoạt động vẫn hợp lệ và không nhận đặt phòng mới.
- Validation client + lỗi server liên kết aria-describedby, focus lỗi đầu tiên; 409 trùng số phòng vào ô số phòng, lỗi loại vào ô loại phòng, lỗi chung dùng getErrorMessage/Alert. Lock ref + Button loading chống submit lặp; giữ dữ liệu khi lỗi. Thành công invalidate list/detail, thông báo và đóng modal, giữ filter/trang.
- Sửa lỗi focus bằng useLayoutEffect cho modal: chụp focus nút mở trước khi form lấy focus; Esc trả focus đúng trigger, native dialog giữ Tab bên trong. Component/token dùng chung, không Lucide/hex, vùng chạm 44px, modal cuộn dọc trên 375px, không tràn document.

### Seed, baseline và kiểm tra thực tế

- Không đổi seed/registry: roles → users → amenities → room-types → rooms → bookings → feedback; giữ `$setOnInsert` và timestamps của phòng Manager đã sửa.
- Baseline main: backend lint/typecheck và 460/460 unit pass. Frontend lint/typecheck pass; lượt baseline 96 test pass nhưng worker suite staff-dashboard timeout trong Windows sandbox; chạy riêng lại ngoài sandbox pass 25/25 (tổng 121 test baseline).
- Main mới có 4 lỗi Prettier ngoài UC48. Người dùng đã **cho phép sửa chỉ định dạng, giữ nguyên logic**. Nhánh `fix/31-format-baseline`, commit `cb25d1b`, merge main `98b1355`: bookings.module.ts, room-type-pricing.adapter.ts, availability-search.e2e-spec.ts, invoice-pricing.e2e-spec.ts. Đối chiếu AST cả 4 file không thay đổi, format check toàn backend pass; không sửa schema/logic booking/invoice.
- Backend: lint, format:check, typecheck, test **506/506** (22 files), test:e2e **133/133** (18 files), build pass. E2e đầy đủ trên `hms_uc48_full_test` cục bộ; suite UC48 dùng DB riêng mỗi invocation, chỉ dọn fixture tự tạo, không xóa collection module khác. Có 401/403 toàn endpoint mới, validation/defaults, unique/race, partial update, reactivation, Booking/RoomHold nguyên vẹn khi ngừng, DELETE 404, options >100, Swagger và seed idempotent. Các suite booking/availability/invoice hiện có đều pass.
- Frontend: lint, format:check, typecheck, test **139/139** (13 files), build pass. Có test client/server errors, pending chống bấm lặp, create/edit, inactive type, thiếu options, confirm ngừng/bật lại, giữ filter/trang, focus/Esc và guard các vai trò. Mock chỉ ở tầng API trong test. Build còn cảnh báo bundle >500kB của ứng dụng, không phải lỗi build.
- `npm run seed` thật hai lần trên `hms_uc48_seed_test`: sau lần một sửa phòng 101 (floor=-2, notes, isActive=false, updatedAt), lần hai snapshot toàn bộ rooms giữ nguyên cả timestamps. Ban đầu Windows chặn unlink artifact cũ trong backend/dist và frontend/dist; đã chuyển artifact sang backup trong `.task29-validation/` rồi chạy lại thành công, không sửa cấu hình build hoặc env người dùng.
- API Node đã build + Vite + Edge headless thật: Swagger `/api/docs-json` đủ POST/GET :id/PATCH rooms và room-types/options; UI tạo → sửa → ngừng → bật lại gọi API/MongoDB thật, có 2 xác nhận, giữ filter. Viewport/document đều 375px, modal 343px; Tab không thoát modal, Esc trả focus trigger, focus lỗi client đúng. Artifact cục bộ ignored: `.task29-validation/uc48-browser-result.json`, `uc48-form-mobile-375.png`, `uc48-seed-result.json`.
- Docker local **không chạy**, được miễn theo yêu cầu thường trực của người dùng; không báo Docker pass. Không chỉnh Jira hoặc nhánh của người khác. Không có mock production/TODO chặn chức năng UC48; không triển khai Equipment/H6 adapter/H7 pricing hoặc các task ngoài scope.

Task tiếp theo được mở khóa: module lễ tân/Khoa có thể tái sử dụng Room/RoomStatus và service; #37 Equipment tham chiếu Room khi làm task riêng. Các thay đổi rule đặt phòng/giá cần Hiếu quyết định theo hợp đồng hiện có.

<a id="uc51"></a>
## #32 — UC51 View Amenity List

Ngày 24/10/2026; baseline main `94455ff`. Nhánh `feature/32-amenity-list`. Tiền đề #28/#29 đã có: Amenity/RoomType schema, RoomType.amenities ref Amenity, seed và GET /amenities/options. Đã kế thừa mẫu bảng/bộ lọc/phân trang của room-types/rooms, guard và component hiện có; không thay layout H10.

### API, schema và cách tích hợp

- Thêm `GET /api/v1/amenities`, quyền Manager OR facility:manage, Swagger đầy đủ; lỗi chuẩn từ filter toàn cục. Giữ nguyên `GET /api/v1/amenities/options`: chỉ tiện nghi active, response `{ id, name }[]` cho form UC50.
- `ListAmenitiesQuery`: search tên literal không phân biệt hoa thường (escape regex, tối đa 100 ký tự); isActive true/false, mặc định tất cả; page >=1 mặc định 1; limit 1–100 mặc định 10; sortBy name/createdAt, sortOrder asc/desc, mặc định name asc và `_id asc` làm tiêu chí phụ. Dùng validation/whitelist/forbidNonWhitelisted/transform hiện có.
- `AmenityListResponse` `{ items, total, page, limit }`; item `{ id, name, description, isActive, roomTypes: [{ id, name, isActive }], roomTypeCount }`. RoomTypes sort name rồi _id; hiển thị cả Amenity/RoomType inactive. Chưa gắn thì mảng rỗng/count=0; tham chiếu Amenity mồ côi trong RoomType bị bỏ qua, không tự dọn dữ liệu.
- `AmenitiesService.list(query)` lấy trang + count bằng hai truy vấn Amenity, sau đó **một truy vấn RoomType** với `amenities: { $in: pageIds }`, select name/isActive/amenities, gom nhóm trong service. Tổng 3 query cho trang có dữ liệu, 2 query nếu trang rỗng; không N+1. Dedupe ID lặp trong cùng RoomType để count phản ánh số loại phòng.
- Thay đổi schema duy nhất: `RoomTypeSchema.index({ amenities: 1 })`, Mongo tự tạo multikey cho mảng. Amenity schema và quan hệ một chiều RoomType.amenities giữ nguyên; không thêm Amenity–Room, không sửa Room. Production autoIndex=false nên khi triển khai cần tạo index tương ứng (`db.roomtypes.createIndex({ amenities: 1 })`); phiên này không chạy lệnh trên production.
- AmenitiesModule đăng ký lại **chính RoomTypeSchema hiện có** qua MongooseModule.forFeature để inject model dùng đọc, không tạo schema thay thế và không import RoomTypesModule gây vòng phụ thuộc (RoomTypesModule đang import AmenitiesModule). Export/options/validateNew tiếp tục tương thích.
- Không có POST/PATCH/GET :id/DELETE Amenity. Không thay đổi bookings/availability/invoices/payments/rooms, auth/users/roles hoặc các nhánh của người khác; không chỉnh Jira.

### Frontend

- `features/amenities/`: api.ts, hooks.ts, components/RoomTypeChips.tsx, pages/AmenitiesPage.tsx, routes.tsx. Gắn `/manager/amenities` dưới PublicLayout và thêm menu Manager “Tiện nghi”. RequireAuth cùng quyền OR như backend; custom role có facility:manage được dùng route.
- Một H1, tìm tên debounce 300ms, lọc Tất cả/Đang hoạt động/Ngừng; đổi filter reset page, đổi page giữ filter. Bảng tên, mô tả, Room Type gắn, số loại phòng căn phải, trạng thái có chữ. Mô tả truncate với title/aria-label/focus; tối đa ba chip và native details `+N loại phòng` để mở phần còn lại, có nhãn `(ngừng)`; chưa gắn ghi rõ “Chưa gắn Room Type nào”.
- Đủ loading, lỗi backend + thử lại, rỗng catalog/rỗng do lọc. Không có nút ghi hoặc mock production. Token/component chung, không Lucide/hex; bảng cuộn trong container trên 375px, summary/nút/control vùng chạm >=44px, focus/hover và reduced motion theo design system.

### Seed và giới hạn nghiệp vụ

- Giữ ba mẫu Wi-Fi/Điều hòa/Bồn tắm và liên kết RoomType seed hiện tại (gồm Suite inactive). Bổ sung “Máy sấy tóc” active chưa gắn và “Điện thoại bàn” inactive chưa gắn. Không tự gắn thêm tiện nghi vào Room Type người dùng đã sửa.
- Seed Amenity dùng $setOnInsert/upsert, timestamps:false cùng createdAt/updatedAt chỉ khi insert, để chạy lại không thay đổi bất kỳ field/timestamp đã chỉnh. Registry giữ roles → users → amenities → room-types → rooms → bookings → feedback.
- Giả định đã áp dụng đúng prompt: danh sách hiển thị dữ liệu gắn thực tế kể cả inactive; BR-FAC-06 về gắn mới thuộc UC52, không tự đưa rule ngừng/xóa hoặc đổi unique name vào UC51.
- Điểm mở rộng #33/UC52: tái sử dụng schema/module, list query/key `amenities`, response, route/guard/UI hiện tại; bổ sung DTO/service/controller ghi và editor riêng, invalidate list/options sau mutation. Chưa triển khai #33, không coi read API là đủ CRUD.

### Kiểm tra và xuất bản UC51

- Code: `a00b9c0` (backend), `3233696` (frontend). Đã tích hợp main mới `04f752c` (hoàn thiện booking của Hiếu) tại `d0c3481`; không sửa logic của Hiếu. Bàn giao qua PR [#21](https://github.com/duongvn9/hotel-mangagement-system/pull/21), tên `feat(amenities): UC51 view amenity list (#32)`.
- Baseline main `94455ff`: backend lint/typecheck và **506/506** unit pass; frontend lint/typecheck và **139/139** test pass.
- Backend cục bộ: lint, format:check, typecheck, **525/525** unit (23 files), build pass. Lượt full e2e cục bộ trên baseline cũ đã dừng khi main có phần booking completion mới; không báo lượt bị dừng là pass.
- Bản tích hợp mới được kiểm tra thật trên GitHub Actions run [40061147570](https://github.com/duongvn9/hotel-mangagement-system/actions/runs/40061147570): backend lint/format/typecheck, **525/525 unit**, **166/166 e2e** (23 files), build đều pass. Bao gồm các suite room-types/rooms/bookings và luồng booking/payment mới, không skip để che lỗi.
- Frontend cục bộ: lint, format:check, typecheck, **151/151** test (14 files), build pass; CI frontend cũng pass. Lượt dùng fork có 148 test pass nhưng suite LoginPage cũ timeout khởi tạo worker trên Windows; chạy lại toàn bộ bằng `--pool=threads` đã pass 151/151, không đổi cấu hình CI/production. Build còn cảnh báo bundle lớn >500kB như ứng dụng hiện có.
- Unit UC51 xác minh query literal/false, phân trang/sort, reverse references/count/inactive/unattached/orphan, dedupe và đúng một RoomType query với 1/10/100 amenities. E2e dùng DB riêng mỗi invocation và chỉ dọn fixture tự tạo; có 401/403, 400 query sai, read-only snapshot, options nguyên vẹn, không có endpoint ghi/detail và seed hai lần giữ sửa đổi/timestamps.
- `npm run seed` thật **hai lần** trên `hms_uc51_seed_test`: có 5 amenities, fixture nhiều loại phòng/loại ngừng/chưa gắn/tiện nghi ngừng; sau lần một sửa Wi-Fi description/isActive/updatedAt, snapshot toàn bộ Amenity giữ nguyên sau lần hai. Thêm hai RoomType fixture chỉ trong database kiểm thử để kiểm tra UI `+N`, không đưa fixture vào production code.
- Swagger chạy thật `/api/docs-json` có GET amenities và options đúng schema. Node API đã build + MongoDB thật + Vite + Edge: viewport/document **375px**, container bảng **341px**, table **800px**, một H1, menu đúng route; mở `+2`, nhãn Suite (ngừng), mô tả focus/title/aria, tìm/lọc và rỗng do lọc đều pass. Network chỉ GET và CORS OPTIONS; response catalog trước/sau giữ nguyên. Ảnh đã xem trực tiếp. Artifact ignored: `.task29-validation/uc51-browser-result.json`, `uc51-mobile-375.png`, `uc51-seed-result.json`, `uc51-ci-backend.log`.
- Docker cục bộ **không chạy**, tiếp tục được miễn theo yêu cầu người dùng. Job build image tự động của PR đã pass; phân biệt kết quả CI với việc không chạy Compose cục bộ. Không có TODO/stub/mock production chặn UC51.

<a id="uc52"></a>
## #33 — UC52 Create / Update Amenity

Ngày 24/10/2026; baseline main `266e40b` (đã có #28/#29, #31, #32 và Issue của Vũ). Nhánh `feature/33-amenity-form`. Các mục UC51 phía trên mô tả phạm vi lúc bàn giao UC51; API ghi và nút quản lý được bổ sung ở UC52 dưới đây.

### Hợp đồng API và tích hợp

- `POST /api/v1/amenities` → 201; `GET /api/v1/amenities/:id` → 200; `PATCH /api/v1/amenities/:id` → 200. Response đồng nhất item danh sách: `{ id, name, description, isActive, roomTypes: [{ id, name, isActive }], roomTypeCount }`. `/options` vẫn khai báo trước `:id`, giữ response/options active hiện có. Không có DELETE.
- `CreateAmenityDto`: name bắt buộc, trim, không rỗng, tối đa 100 ký tự; description tùy chọn/trim/mặc định `''`; isActive tùy chọn/mặc định true; roomTypeIds tùy chọn/mặc định `[]`, mảng ObjectId hex thường đúng 24 ký tự, không trùng. `UpdateAmenityDto` kế thừa partial, từ chối null; PATCH cần ít nhất một field có giá trị. Whitelist/forbidNonWhitelisted/transform dùng validation toàn cục, từ chối field lạ/_id/timestamps.
- Tên unique theo **index hiện có, phân biệt hoa thường**; precheck và bắt E11000 (kể cả race) → 409. ID tiện nghi sai → 400, không tồn tại → 404. Các route mới giữ guard Manager OR facility:manage và lỗi chuẩn `{ statusCode, message, error, path, timestamp }`; Swagger ghi DTO/response và các mã lỗi.
- `AmenitiesService.create(dto)`, `detail(id)`, `update(id,dto)` dùng Amenity model và **RoomType model đã inject từ UC51**. AmenitiesModule không thay đổi: đăng ký chính RoomTypeSchema qua MongooseModule.forFeature, không import RoomTypesModule, không forwardRef/provider mới. RoomTypesModule → AmenitiesModule vẫn là một chiều; e2e khởi động AppModule thật và kiểm tra metadata.
- `roomTypeIds` trong PATCH là **tập hợp đích**, vắng field thì giữ gắn kết. Chỉ phần gắn mới phải tồn tại và active; giữ/gỡ liên kết tới RoomType inactive được phép. Tiện nghi inactive không được gắn mới; vẫn sửa metadata, gỡ liên kết hoặc bật lại được. Ngừng giữ nguyên ID/bản ghi/liên kết và idempotent.
- Quan hệ duy nhất vẫn là `RoomType.amenities`; không thêm collection/quan hệ ngược, không gắn Amenity vào Room, không sửa schema Room hoặc bookings/availability/invoices/payments. Form RoomType tiếp tục dùng AmenitiesService.validateNew và amenity-options như trước.

### Thứ tự ghi, bù trừ và giới hạn

- Kiểm tra toàn bộ DTO, unique name, effective active và tất cả RoomType gắn mới **trước lần ghi đầu tiên**. Không mở session/transaction hay thay cấu hình replica set (Mongo dev/CI standalone).
- Tạo: insert Amenity trước → một bulkWrite `$addToSet`. Nếu gắn kết lỗi, `$pull` đúng ID vừa tạo khỏi các RoomType rồi deleteOne đúng bản ghi đó, trả 503 thay vì thành công. Pull chạy trước delete để tránh tạo tham chiếu mồ côi khi cleanup lỗi. Nếu cleanup cũng không thực hiện được, giữ bản ghi còn lại, log và trả 503 kèm ID + yêu cầu kiểm tra dữ liệu trước khi tạo lại; không cam kết rollback khi Mongo mất kết nối toàn bộ.
- Sửa: chỉ `$set` field Amenity được gửi trước (bắt unique race) → một bulkWrite `ordered:false`, `$addToSet` phần thêm và `$pull` phần gỡ. Không thay thế toàn mảng đã đọc, giữ các tiện nghi khác. Filter thêm có isActive=true; số document matched phải đủ, nếu RoomType thay đổi giữa kiểm tra và ghi thì không báo thành công.
- BulkWrite PATCH lỗi → 503 nói rõ metadata có thể đã lưu, cần gửi lại cùng yêu cầu. Server tính lại phần thêm/gỡ trên dữ liệu hiện tại; thao tác idempotent hội tụ về tập đích khi không có request cạnh tranh. Đây **không phải ghi nguyên tử nhiều document**: có thể đọc thấy trạng thái trung gian; hai request đặt tập đích khác nhau hoặc đổi active đồng thời chưa được serialize. Kiểm tra active là snapshot; không bảo đảm chống mọi race giữa hai module. Không bổ sung business rule hoặc transaction để che giới hạn này.

### Frontend và bàn giao

- Mở rộng `/manager/amenities` hiện có, giữ route/menu/RequireAuth. Nút “Thêm tiện nghi”, “Sửa” từng dòng mở native dialog chung `AmenityEditor`/`AmenityForm`, theo mẫu UC50/UC48: focus tên khi mở, Esc đóng và trả focus trigger, chặn đóng khi đang gửi. Modal có cuộn dọc và native Tab trap.
- Tên, textarea mô tả, active, nhóm checkbox tìm nhanh Room Type dùng lại **GET /room-types/options**, không tải/chọn Room. Giữ lựa chọn RoomType inactive từ detail với nhãn `(ngừng)` và cho gỡ. Amenity inactive chặn chọn mới, giải thích cần bật lại; vẫn cho tạo tiện nghi không gắn loại phòng nào, kể cả khi options rỗng/lỗi.
- Hành động ngừng/kích hoạt lại riêng có confirm, gửi riêng isActive; copy ngừng nêu rõ giữ bản ghi và gắn kết, không gắn mới. Save chỉ gửi field thay đổi, client/server field errors có aria-describedby và focus lỗi đầu tiên; 409 tên gắn ô tên, ID RoomType bị từ chối được đổi thành tên trong nhóm chọn. Lỗi chung qua getErrorMessage/Alert; giữ draft và target set để retry, khóa submit lặp bằng pending/ref.
- Thành công invalidate `amenities`, `amenity/:id`, `amenity-options`, `room-types` (gồm options/list), `room-type` (detail); đóng modal, thông báo, giữ bộ lọc/trang. Dùng component/token chung, không Lucide/hex/mock production. Không có nút xóa.
- Seed/registry không thay đổi: roles → users → amenities → room-types → rooms → bookings → feedback. Seed Amenity giữ metadata/timestamp Manager; RoomType seed giữ field/gắn kết đã sửa nhưng vẫn cập nhật updatedAt như code có sẵn.
- Giả định theo prompt, chưa coi là rule SRS mới được nhóm duyệt: active RoomType cho phần gắn mới; giữ liên kết inactive; isActive là trạng thái mềm; PATCH theo tập đích; xử lý standalone bằng kiểm tra trước/ghi idempotent/bù trừ và retry. Không thêm unique không phân biệt hoa thường, giới hạn số RoomType hoặc chặn ngừng khi đang gắn.
- Hợp đồng cho module sau: tái sử dụng AmenitiesService/create/update/detail và DTO nói trên; đọc quan hệ từ RoomType.amenities, không thêm quan hệ Room. #34/#35 Service là task riêng, UC52 không tạo Service/Equipment/H6/H9/H10. Không có TODO/stub chặn chức năng.

### Kiểm tra và xuất bản UC52

- Baseline main `266e40b`: backend lint/typecheck, **563/563** unit (25 files); frontend lint/typecheck, **166/166** test (15 files) pass.
- Test mới có validation DTO/null/canonical/unknown, prewrite no mutations, E11000, target set/retained inactive, inactive rules, compensation/cleanup failure, partial PATCH replay, operator preservation; e2e DB riêng mỗi invocation tạo AppModule thật, 401/403 mọi route mới, lỗi chuẩn, đọc quan hệ hai chiều, no DELETE, Swagger và seed bảo toàn dữ liệu. Chỉ mock ở test; e2e giả lập lỗi bulkWrite sau một thao tác thật để kiểm tra trạng thái Mongo.
- Backend lint/format:check/typecheck/build pass; toàn bộ unit **598/598** (26 files), toàn bộ e2e **186/186** (25 files) pass trên MongoDB standalone cục bộ (`hms_uc52_full_test`, suite UC52/UC51 dùng database ngẫu nhiên riêng mỗi invocation). Bao gồm room-types/rooms/bookings/availability/invoice hiện có.
- Frontend lint/format:check/typecheck/build pass, toàn bộ **180/180** test (16 files) pass; gồm hai suite tiện nghi **26/26**. Chạy unit/UI bằng `--pool=threads --maxWorkers=1 --testTimeout=30000` trên Windows; e2e dùng thêm `--hookTimeout=60000 --no-cache`. Không sửa cấu hình CI/production để né test. Bundle hiện tại còn cảnh báo >500kB, build vẫn thành công.
- `npm run seed` thật hai lần trên `hms_uc52_seed_20261024_test`: sau lần một sửa description/isActive/updatedAt của Wi-Fi và đổi tập liên kết thành Deluxe + Suite inactive; lần hai snapshot Amenity (gồm timestamp) và field/liên kết RoomType giữ nguyên. Khi so RoomType đã loại updatedAt vì seed RoomType có sẵn cập nhật timestamp, không báo timestamp RoomType được giữ nguyên.
- Node API build + MongoDB + Vite + Edge thật: Swagger UI `/api/docs` trả 200, `/api/docs-json` có đủ POST/GET :id/PATCH amenities và room-types/options. UI tạo → sửa từ Standard sang Deluxe → ngừng giữ liên kết → bật lại; API RoomType phản ánh đúng. Giữ filter, hai confirm, chặn chọn mới khi inactive, focus lỗi, native Tab trap/Esc trả focus đều pass. Viewport/document **375px**, modal **343px**, scrollWidth **341px**; ảnh đã được mở xem. Artifact ignored: `.task29-validation/uc52-browser-result.json`, `uc52-form-mobile-375.png`, `uc52-seed-result.json`.
- Code: `e8e4ed7` (backend), `bcdce1e` (frontend). Bàn giao qua PR [#23](https://github.com/duongvn9/hotel-mangagement-system/pull/23), tên `feat(amenities): UC52 create/update amenity (#33)`. Mọi check cục bộ bắt buộc đã pass, trừ Docker được miễn; chỉ merge PR bằng merge commit sau khi CI xanh, rồi đồng bộ main. Trạng thái xuất bản và check cuối cùng xem trực tiếp tại PR.
- Docker cục bộ không chạy theo yêu cầu thường trực của người dùng; không tuyên bố Compose pass. Không sửa Jira hoặc nhánh người khác.

<a id="uc53"></a>
## #34 — UC53 View Service List / hợp đồng H4

Ngày 24/10/2026; baseline main `5e4bc10`, nhánh `feature/34-service-list`. Đã đối chiếu nền auth/RBAC, isMoneyVnd, registry seed và mẫu danh sách UC51. Đây là module Service đầu tiên; không có module/schema ServiceOrder để thay thế hoặc tích hợp giả.

### Schema Service và H4 cho Vũ/Hiếu

- File `backend/src/modules/services/schemas/service.schema.ts`: export `Service`, `ServiceSchema`, `SERVICE_COLLECTION_VALIDATOR`; model Service, collection `services`, timestamps. Field: name bắt buộc/trim/unique chính xác (phân biệt hoa thường); description và unit chuỗi tùy chọn/trim/mặc định `''`; billable boolean bắt buộc/mặc định true; price số nguyên VND không âm hoặc null/mặc định null; isActive boolean/mặc định true. Không cast chuỗi giá hoặc boolean từ chuỗi thành giá trị hợp lệ; setter chặn sai kiểu, validator dùng isMoneyVnd (cho phép 0 và giới hạn số nguyên an toàn).
- BR-FAC-08: billable=true **và** isActive=true thì bắt buộc có price hợp lệ; billable đang ngừng có thể chưa có giá, không billable cũng có thể không giá. Giá đã cung cấp phải hợp lệ dù dịch vụ ngừng/không tính phí. Không mặc định 0 thay cho giá chưa cấu hình.
- Ngoài validator Mongoose và conditional required, `collectionOptions` khai báo `$jsonSchema`, validationLevel=strict/validationAction=error. Khi collection được tạo qua ServiceSchema, Mongo kiểm tra cả update/bulkWrite/pipeline/raw driver (không chỉ save hay runValidators). E2e xác minh validator được cài thật, các đường ghi sai bị mã Mongo 121 và cập nhật đồng thời price=0/isActive=true hợp lệ. Không dùng transaction/session hoặc đổi cấu hình Mongo.
- Triển khai: collection mới lấy validator từ ServiceSchema khi Mongoose tạo collection. **Collection có sẵn không được createCollection tự sửa validator**: cần người triển khai áp dụng `collMod` với SERVICE_COLLECTION_VALIDATOR + validationLevel strict/validationAction error, kiểm tra dữ liệu cũ trước khi cho writer sử dụng. Production autoIndex=false nên phải tạo unique index `{ name: 1 }` tương ứng. Đây là thao tác triển khai/DDL, phiên này chỉ kiểm chứng trên DB test, không chạy migration production hoặc tự sửa collection của người khác. Writer có đặc quyền cố ý bypassDocumentValidation nằm ngoài bảo đảm này.
- ServicesModule đăng ký ServiceSchema, export MongooseModule và ServicesService, AppModule import ServicesModule. Module khác import ServicesModule rồi inject `@InjectModel(Service.name)` hoặc ServicesService; không cần đăng ký schema trùng, không có import ngược/module cycle. ServicesService hiện chỉ có `list(query)`; UC54 sẽ mở rộng riêng.
- **Bổ sung ngoài ERD theo prompt, cần nhóm xác nhận:** billable phục vụ SRS UC53/UC54 + BR-FAC-08; unit vẫn được giữ từ ERD nhưng tùy chọn. Không thêm category, lịch sử giá, enum hoặc quan hệ mới.
- BR-FAC-07: Manager API hiển thị cả active/inactive; Vũ phải dùng isActive=true khi chọn dịch vụ cho ServiceOrder mới ở task riêng. Service.price là **giá hiện hành**; giá chốt khi đặt nằm ở ServiceOrder.UnitPrice theo ERD, không đọc lại giá Service để sửa giá chốt của đơn cũ. UC53 không triển khai ServiceOrder/thu phí hóa đơn; bàn giao billable/price/unit cho Vũ và Hiếu dùng đúng hợp đồng.

### API, seed và frontend

- Chỉ `GET /api/v1/services`, quyền Manager OR facility:manage, Swagger đủ query/response/400/401/403. Query ListServicesQuery: search tên literal không phân biệt hoa thường, escape regex, tối đa 100 ký tự; billable/isActive true hoặc false, vắng thì tất cả; page >=1 mặc định 1, limit 1–100 mặc định 10; sortBy name|price|createdAt, sortOrder asc|desc, mặc định name asc, `_id asc` làm tiêu chí phụ. Whitelist/forbidNonWhitelisted/transform và error filter dùng toàn cục; page làm skip vượt số nguyên an toàn bị 400.
- Response `{ items, total, page, limit }`; item chỉ `{ id, name, description, unit, billable, price, isActive }`, price thiếu được chuẩn hóa null. Một aggregate `$match` + `$facet` lấy items/count; khi sort price, tính cờ thiếu giá, sort cờ asc trước price theo chiều yêu cầu rồi mới skip/limit. Null/missing luôn cuối cả asc/desc và qua ranh giới trang, không lộ cờ nội bộ.
- GET chỉ đọc; không có POST/PATCH/GET :id/DELETE, không làm UC54 (#35), không có nút thêm/sửa/ngừng/xóa. Không sửa bookings/availability/invoices/payments/rooms hoặc enum chung.
- `services/seed.ts` dùng $setOnInsert/upsert, timestamps:false, createdAt/updatedAt chỉ insert để giữ toàn bộ sửa đổi Manager và timestamps khi chạy lại. Sáu mẫu: Giặt ủi 50.000/lần, Ăn sáng tại phòng 150.000/suất, Đưa đón sân bay 450.000/chuyến, Đón tiếp khách billable giá 0, Thông tin du lịch không billable không giá, Chăm sóc spa billable đang ngừng/chưa giá. Có và không có unit, tất cả thỏa schema.
- Registry: **roles → users → amenities → room-types → rooms → services → bookings → feedback**. Không thay seed của module khác.
- Frontend feature services gồm api.ts, hooks.ts, components/ServicePrice.tsx, pages/ServicesPage.tsx, routes.tsx. Route `/manager/services` ghép dưới PublicLayout, menu Manager “Dịch vụ”; RequireAuth cùng quyền OR, không viết lại H10.
- Một H1; tìm tên debounce 300ms, lọc Tất cả/Tính phí/Miễn phí và Tất cả/Đang hoạt động/Ngừng; đổi filter reset trang, đổi trang giữ filter. Bảng Tên/Mô tả/Tính phí/Giá/Trạng thái; Badge có chữ. Giá Intl vi-VN/VND căn phải, kèm unit nếu có; 0 hiển thị “0 ₫”, thiếu giá “—”. Mô tả truncate có title/aria-label/tabIndex đọc bằng bàn phím; loading/lỗi getErrorMessage + retry/rỗng catalog/rỗng do lọc đầy đủ.
- Dùng component/token chung, không Lucide/hex/mock production; bảng cuộn trong container mobile, control/nút 44px, focus/hover/reduced motion dùng design system. Điểm mở rộng #35: tái sử dụng schema/DTO response/query/provider/route và query key `services`, thêm writer/editor ở task riêng, invalidate list sau lưu; không có stub/nút chết chờ UC54.

### Kiểm tra và xuất bản UC53

- Baseline main `5e4bc10`: backend lint/typecheck và **598/598** unit (26 files); frontend lint/typecheck và **180/180** test (16 files) pass.
- Test UC53 riêng: **44 unit**, **21 e2e**, **13 frontend** pass. Có schema/type/BR-FAC-08/unique, filter literal/false, pagination/sorts/null cuối, empty/read-only, guard mọi role, lỗi chuẩn, seed idempotent và AppModule thật; frontend kiểm tra tiền/unit/0 vs null, Badge, loading/retry/rỗng, filter/trang, guard/menu. E2e dùng DB ngẫu nhiên riêng mỗi invocation từ URI test, chỉ dọn fixture Service tự tạo, không xóa collection module khác.
- Code: `47d52ba` (backend/H4), `f21f081` (frontend). Đã tích hợp main `787d1b8` (Issue list/detail của Vũ) tại `d22984a`; giữ nguyên logic/menu của Vũ, diff UC53 chỉ thêm menu Dịch vụ. Bản trước tích hợp đã qua **642/642** backend unit và **193/193** frontend test; lượt full e2e trước tích hợp được dừng khi main mới xuất hiện, không báo lượt bị dừng là pass.
- Bản tích hợp: backend lint/format:check/typecheck/build, **682/682** unit (28 files) và toàn bộ **213/213 e2e** (26 files) pass trên MongoDB standalone test; gồm các suite room-types/rooms/amenities/bookings/availability/invoices/Issue hiện có. Frontend lint/format:check/typecheck/build và **213/213** test (18 files) pass. Bundle còn cảnh báo >500kB như ứng dụng hiện có, không phải lỗi build. Chạy unit/UI trên Windows bằng `--pool=threads --maxWorkers=1 --testTimeout=30000`; e2e thêm `--hookTimeout=60000 --no-cache`. Không sửa config CI/production để né test.
- `npm run seed` thật hai lần trên `hms_uc53_seed_20261024_test`: sau lần một sửa Giặt ủi ở description/unit/billable/price/isActive/updatedAt, lần hai snapshot toàn collection Service giữ nguyên cả timestamps, tổng vẫn 6 dòng. Có đủ giá 0, giá null, inactive và collection validator thật. Không dùng database dev.
- Swagger thật `/api/docs` trả 200, `/api/docs-json` có GET services đúng schema và không có route mutation/detail. Node API build + MongoDB + Vite + Edge: viewport/document **375px**, container bảng **343px**, bảng cuộn **806px**, một H1, menu Dịch vụ, mô tả focus/title/aria, giá vi-VN/unit/0 vs null, lọc hai boolean và rỗng do tìm kiếm đều pass. Network chỉ GET và CORS OPTIONS; response catalog trước/sau giữ nguyên. Ảnh đã được mở xem; artifact ignored `.task29-validation/uc53-mobile-375.png`, `uc53-browser-result.json`, `uc53-seed-result.json`.
- Mọi check cục bộ bắt buộc đã pass, trừ Docker được miễn theo yêu cầu thường trực của người dùng; không báo Compose pass. Merge bằng merge commit sau CI xanh rồi pull main. Không sửa Jira hoặc nhánh người khác.
- Bàn giao qua PR [#24](https://github.com/duongvn9/hotel-mangagement-system/pull/24), tên `feat(services): UC53 view service list (#34)`; trạng thái merge và check cuối xem trực tiếp tại PR. H4 và trang danh sách đã sẵn để #35/UC54 mở rộng, chưa coi UC53 là CRUD đầy đủ.

<a id="uc54"></a>
## #35 — UC54 Create / Update Service

Ngày 24/10/2026; baseline main `8df46e7` (UC53 đã merge, có thêm Issue handling/closure của Vũ). Nhánh `feature/35-service-form`. Kế thừa ServicesModule/ServiceSchema/list/seed/H4, mẫu modal UC50/UC48/UC52 và guard hiện có. Những mô tả chỉ đọc ở mục UC53 phía trên là phạm vi lúc bàn giao UC53; UC54 mở rộng ghi dưới đây.

### API và kiểm tra trạng thái gộp

- Thêm `POST /api/v1/services` → 201, `GET /api/v1/services/:id` → 200, `PATCH /api/v1/services/:id` → 200. Response giống item list `{ id, name, description, unit, billable, price, isActive }`, không lộ version/timestamps. ID phải là ObjectId hex 24 ký tự (chấp nhận hoa/thường); sai → 400, không tồn tại → 404. GET list UC53 giữ nguyên lọc/sort/null cuối/phân trang.
- `CreateServiceDto`/`UpdateServiceDto`: name trim/bắt buộc/không rỗng/tối đa 100 ký tự; description/unit tùy chọn/trim, mặc định chuỗi rỗng khi tạo; billable/isActive boolean tùy chọn, mặc định true khi tạo; price là số nguyên VND an toàn >=0, hoặc null/vắng (mặc định null), không cast chuỗi/float/âm. PATCH partial cần ít nhất một field có giá trị, price:null là xóa giá; null ở field khác bị từ chối. Whitelist/forbidNonWhitelisted/transform toàn cục từ chối field lạ, _id, timestamps, __v.
- ServicesService tự gộp trạng thái hiện tại với các field thay đổi, kiểm tra BR-FAC-08 **trước khi ghi bất cứ field nào**: kết quả billable && isActive phải có giá hợp lệ. Vi phạm → 400 với message `price: cần giá hợp lệ để kích hoạt dịch vụ tính phí`; không kích hoạt, không lưu cả metadata cùng request. Giá sai định dạng/range cũng gắn vào price. Bắt đủ create thiếu giá, reactivation thiếu giá, false→true billable khi active/chưa giá, xóa giá active/billable. Giá 0 hợp lệ; inactive hoặc không billable có thể chưa có giá; đổi billable không tự đổi/xóa giá.
- Unique name giữ **phân biệt hoa thường** theo schema/index UC53: precheck và bắt E11000 cả tạo/sửa → 409 “Tên dịch vụ đã tồn tại”. Mongoose/schema/Mongo collection validator H4 tiếp tục là lớp bảo vệ phụ; lỗi Mongo 121 được đưa về lỗi price 400. Không dựa riêng vào query validator để suy luận field không gửi.
- Các endpoint mới giữ Manager OR facility:manage và error filter chuẩn `{ statusCode, message, error, path, timestamp }`; Swagger có DTO/response/400/401/403/404/409. Không có DELETE.

### Khóa lạc quan, vô hiệu hóa và hợp đồng H4

- Chọn **__v** đã có sẵn của Mongoose, không thêm field schema. Sau đọc/gộp/validate, findOneAndUpdate khớp `{ _id, __v: versionĐãĐọc }`, chỉ `$set` field được gửi và `$inc: { __v: 1 }`, runValidators=true, returnDocument=after. Không khớp → 409 “Dữ liệu đã thay đổi, hãy tải lại”, không retry mù hoặc ghi đè trên snapshot mới. Bản ghi cũ thiếu __v được khóa bằng `$exists:false` rồi tăng version ở lần ghi đầu.
- Mọi writer cập nhật Service qua model/raw API trong tương lai phải tăng __v tương ứng để cùng tham gia cơ chế này. Khóa bảo vệ khoảng **service đọc → ghi trong một request**; DTO không mang token phiên bản từ lúc mở form, nên chưa bảo đảm phát hiện mọi bản nháp đã cũ trước khi request bắt đầu. Không tuyên bố khóa toàn thời gian người dùng chỉnh form; không dùng transaction/session hay đổi Mongo standalone.
- Ngừng chỉ `$set isActive:false` (kèm metadata/version kỹ thuật), giữ ID/bản ghi/price/billable; gọi lại vẫn 200 và cùng trạng thái nghiệp vụ. Không import/đọc/ghi/xóa ServiceOrder, Invoice hoặc module khác khi ngừng. Không tạo giả ServiceOrder để kiểm tra; đơn dịch vụ cũ thuộc Vũ và không bị UC54 sửa.
- `ServicesService.findActiveById(id): Promise<ServiceResponse | null>` chỉ đọc, trả cùng shape ServiceResponse khi tồn tại và active, null nếu inactive/không tồn tại/ID sai. Không có endpoint công khai riêng cho helper. ServicesModule vẫn export ServicesService và MongooseModule; Vũ/Hiếu import module rồi inject service/model Service như H4, không tạo phụ thuộc vòng.
- BR-FAC-07 tập trung qua helper khi chọn dịch vụ cho ServiceOrder mới. price là giá hiện hành; giá chốt lúc đặt thuộc ServiceOrder.UnitPrice theo ERD, UC54 không tính lại đơn cũ/không triển khai hóa đơn. billable vẫn là bổ sung ngoài ERD đã chọn theo prompt UC53; unit tùy chọn theo ERD. Không đổi schema Service/Room/Amenity/RoomType hoặc logic bookings/availability/invoices/payments/rooms.

### Frontend và vận hành

- `/manager/services` giữ route/menu/RequireAuth; thêm “Thêm dịch vụ”, “Sửa” từng dòng. `ServiceEditor`/`ServiceForm` native dialog chung tạo/sửa: tên, textarea mô tả, đơn vị tùy chọn, Tính phí, giá VND, Đang hoạt động. Tải detail trước khi sửa, có loading/lỗi/thử lại. useLayoutEffect chụp focus trigger trước khi form focus tên; Esc đóng/trả focus, chặn Esc/đóng khi đang gửi hoặc tải lại; native dialog giữ Tab.
- Giá nhập vi-VN (50.000 → 50000), format khi blur, 0 hợp lệ; để trống → null; âm/thập phân/comma/chữ/số vượt safe integer bị từ chối. Khi billable && active thì bắt buộc giá, có hướng dẫn muốn lưu chưa có giá thì đặt Ngừng. Tắt billable không khóa/xóa giá. Client/server lỗi có aria-describedby/focus ô lỗi đầu tiên, price 400 vào ô giá, tên trùng 409 vào ô tên, lỗi chung getErrorMessage + Alert.
- Ngừng/kích hoạt lại là hành động riêng có confirm, dùng thông tin đã lưu và gửi riêng isActive. Copy ngừng nêu rõ giữ dịch vụ, không còn chào khách đặt mới, yêu cầu dịch vụ đã có không ảnh hưởng. Nếu bản ghi billable chưa có giá, reactivation nhận 400 từ BE tại ô giá; để kích hoạt cùng giá/thay đổi mới, nhập giá, bật Đang hoạt động và chọn Lưu (gửi các thay đổi cùng request, có confirm).
- Chỉ gửi field thay đổi khi sửa. Pending/ref chống submit lặp, khóa input/nút; giữ draft sau lỗi. Khi 409 đồng thời, Alert hướng dẫn và nút “Tải lại dữ liệu”; giữ bản nháp cho đến khi người dùng xác nhận tải lại. Tải lại lỗi cũng giữ draft và cho thử lại; chỉ thay các field/baseline sau khi nhận detail mới thành công. Background detail refresh không tự ghi đè draft đang sửa.
- Thành công invalidate `services` list và `service` detail, đóng modal/thông báo, giữ bộ lọc/trang. Component/token chung, không Lucide/hex, control 44px, modal cuộn trên 375px, focus/disabled/reduced motion theo design system. Không có nút/đường xóa hoặc mock production.
- Seed/registry/schema giữ nguyên UC53: roles → users → amenities → room-types → rooms → services → bookings → feedback; insert-only seed không sửa dữ liệu/timestamps/version Manager đã cập nhật. Không sửa Jira hoặc nhánh người khác. Theo yêu cầu mới của người dùng, merge PR giữ tiêu đề mặc định `Merge pull request #…`, PR title/commit code vẫn Conventional Commits scope services.

### Kiểm tra và xuất bản UC54

- Code: `3a84892` (backend/API/locking), `7618db2` (frontend/editor). Baseline main `8df46e7`: backend lint/typecheck, **731/731 unit** (29 files); frontend lint/typecheck, **258/258 test** (20 files) pass.
- Kiểm tra dịch vụ riêng: **48 unit UC54**, **43 e2e dịch vụ** (UC53+UC54), **36 frontend dịch vụ** pass. E2e AppModule thật/DB ngẫu nhiên riêng mỗi invocation, 401/403 mọi route mới, merged-state no writes, public contract, unique/race, real competing Mongo write tăng version để chứng minh 409 giữ winner, helper H4, seed và Swagger. Chỉ dọn fixture Service tự tạo, không xóa collection module khác. Frontend mock ở tầng API, có giá/zero/null, errors/draft/reload, pending, confirm, giữ filter/page và focus/Esc.
- Backend lint/format:check/typecheck/build, toàn bộ **779/779 unit** (30 files) và toàn bộ **251/251 e2e** (28 files) pass trên MongoDB standalone test, gồm các suite facilities/bookings/availability/invoices/Issue hiện có. Frontend lint/format:check/typecheck/build và toàn bộ **281/281 test** (21 files) pass; bundle vẫn có cảnh báo >500kB, không phải lỗi build. Unit/UI chạy Windows bằng `--pool=threads --maxWorkers=1 --testTimeout=30000`; e2e thêm `--hookTimeout=60000 --no-cache`. Không đổi cấu hình CI/production để né test.
- `npm run seed` thật hai lần trên `hms_uc54_seed_20261024_test`: sau lần một sửa Giặt ủi description/unit/billable/price/isActive/updatedAt và tăng __v, snapshot sau lần hai giữ nguyên toàn collection Service, vẫn 6 dòng, gồm timestamp/version. E2e riêng đã kiểm tra cùng việc này qua PATCH thật.
- Node API build + MongoDB + Vite + Edge thật: `/api/docs` trả 200, docs-json có đủ POST/GET :id/PATCH services, không có DELETE. UI tạo giá 0 → sửa giá 150.000 → ngừng giữ giá/bản ghi → bật lại; trùng tên 409 giữ draft, tạo bản nháp billable không giá, chặn reactivation thiếu giá rồi lưu price=0 + active thành công. Giữ filter, 4 confirm, client error focus, native Tab trap/Esc trả focus đều pass. Viewport/document **375px**, modal **343px**, scrollWidth **341px**, ảnh đã mở xem. Artifact ignored: `.task29-validation/uc54-browser-result.json`, `uc54-form-mobile-375.png`, `uc54-seed-result.json`. Đã dọn các tiến trình API/Vite/Edge tạm, giữ MongoDB đang có.
- Mọi check cục bộ bắt buộc đã pass, trừ Docker được miễn theo yêu cầu thường trực; không báo Compose pass. Chỉ merge PR sau khi CI của commit cuối xanh rồi pull main; giữ tiêu đề merge `Merge pull request #…` theo yêu cầu người dùng.
- Bàn giao qua PR [#28](https://github.com/duongvn9/hotel-mangagement-system/pull/28), tên `feat(services): UC54 create/update service (#35)`; trạng thái merge/check cuối xem trực tiếp tại PR. H4 đã có model/schema/provider và helper active để Vũ/Hiếu tích hợp ở các task riêng; UC54 không triển khai ServiceOrder hoặc phí hóa đơn.

<a id="h9"></a>
## #36 — H9 Gmail Notifications (24/10/2026)

- Nhánh: `feature/36-gmail-notification`, từ main `66ab813`. Chỉ backend: không controller, frontend, collection hay tích hợp vào nghiệp vụ của Hiếu/Khoa.
- `NotificationsModule` chỉ import `ConfigModule`, export `NotificationsService`; AppModule đăng ký module này. Không import module booking/payment. Dùng lại `BookingStatus` và `PaymentPurpose` sẵn có.
- Hợp đồng: `send(input: NotificationInput): Promise<NotificationResult>`, kết quả `{ accepted: boolean; reason?: string }`. `accepted: true` chỉ nghĩa đã nhận vào hàng đợi, không xác nhận SMTP/inbox. Validation sai → `invalid_input`; đầy → `queue_full`; tắt ứng dụng → `shutting_down`. Không throw/reject; gửi/retry chạy nền.
- `NotificationTemplate` là union 3 template; `NotificationInput` discriminated union. Kiểu export trong `backend/src/modules/notifications/notification.types.ts`.

| Template | Data bắt buộc |
|---|---|
| `BOOKING_CONFIRMATION` | bookingCode, guestName, checkIn, checkOut, roomsSummary, roomTotal, depositAmount, bookingStatus (`BookingStatus.PendingDeposit` hoặc `.Confirmed`) |
| `PAYMENT_SUCCESS` | bookingCode, guestName, amount, purpose (`PaymentPurpose.Deposit` hoặc `.Final`), paidAt, transactionRef |
| `BOOKING_CANCELLATION` | bookingCode, guestName, checkIn, checkOut, cancelledAt |

Các field này là **đề xuất cần Hiếu/Khoa xác nhận**, chưa phải business rule được nhóm duyệt. Ngày nhận `Date` instant hoặc business date `YYYY-MM-DD` có thật, hiển thị `dd/MM/yyyy` tại `Asia/Ho_Chi_Minh`; không nhận ISO instant dưới dạng string. Tiền là số nguyên VND không âm theo `isMoneyVnd`. Có subject, HTML escape toàn bộ giá trị động và text; mã booking chứa CR/LF/NUL bị từ chối.

### Cấu hình và vận hành

Cập nhật `backend/src/config/configuration.ts`, `notifications.config.ts`, `env.validation.ts`, `backend/.env.example`, `.env.example`, danh sách environment production Compose. Dev Compose đã đọc `.env` ở root qua `env_file`, không cần lặp thêm biến. Các biến `MAIL_*` cũ giữ tương thích cấu hình, **H9 chỉ đọc các biến mới**:

| Biến | Mặc định / ràng buộc |
|---|---|
| `NOTIFICATIONS_ENABLED` | false; bật true mới chọn Gmail SMTP |
| `GMAIL_USER` | bắt buộc email khi bật; dùng làm from address |
| `GMAIL_APP_PASSWORD` | bắt buộc khi bật; bỏ toàn bộ whitespace, không log/commit |
| `NOTIFICATIONS_FROM_NAME` | Grand Emily Hotel; không CR/LF/NUL, tối đa 200 ký tự |
| `NOTIFICATIONS_MAX_ATTEMPTS` | 3; 1–10 tổng số lần gửi |
| `NOTIFICATIONS_RETRY_BASE_DELAY_MS` | 1000; 1–60000 ms |
| `NOTIFICATIONS_SEND_TIMEOUT_MS` | 10000; 1–120000 ms mỗi lần |
| `NOTIFICATIONS_QUEUE_CAPACITY` | 100; 1–10000, gồm active + queued + đang retry |
| `NOTIFICATIONS_SHUTDOWN_TIMEOUT_MS` | 15000; 1–120000 ms |

Mặc định dev/test/production đều tắt, không tạo SMTP transport/kết nối; mỗi thông báo chỉ log debug template + email che (`a***@domain`). Production tắt thì cảnh báo một lần khi khởi động. Bật mà thiếu Gmail config thì Joi từ chối khởi động.

Gửi tuần tự, retry mặc định 3 lần tổng cộng, delay 1000 → 2000 ms. Chỉ lỗi mạng/kết nối/timeout/SMTP 4xx được retry. SMTP 5xx và lỗi không xác định dừng ngay; 535/EAUTH log gợi ý kiểm tra Gmail App Password và xác minh 2 bước. Mỗi thất bại warn, thất bại cuối error; chỉ log mã lỗi đã chọn an toàn, template, người nhận che, attempt, category. Không đưa raw exception/body/password/email đầy đủ vào log.

Shutdown ngừng nhận mới, chờ drain tối đa grace; quá hạn log số dropped, abort socket TLS đang sở hữu và hủy delay/timeout/retry còn lại. SMTP đã nhận trước khi timeout có thể vẫn phát mail: **không bảo đảm exactly-once**, retry có thể trùng. Queue/retry chỉ ở bộ nhớ, mất khi crash/restart; Nest Logger không thay thế kho lưu lịch sử thông báo. Lưu bền/replay cần nhóm chốt thay đổi schema/hạ tầng riêng.

### Cách gọi H9 sau commit (Hiếu/Khoa tự tích hợp)

Import `NotificationsModule` trong module người gọi, inject `NotificationsService`. Chỉ gọi sau khi booking/payment đã commit thành công:

```ts
const booking = await commitBooking(); // nghiệp vụ đã commit
await notifications.send({
  to: guest.email,
  template: 'BOOKING_CONFIRMATION',
  data: {
    bookingCode: booking.code, guestName: guest.name,
    checkIn: booking.checkIn, checkOut: booking.checkOut,
    roomsSummary: '1 phòng Deluxe', roomTotal: booking.roomTotal,
    depositAmount: booking.depositAmount,
    bookingStatus: BookingStatus.PendingDeposit,
  },
});
return booking; // accepted:false cũng không đảo ngược nghiệp vụ
```

Không đặt `send()` trong transaction hay nhánh quyết định thành bại của booking/payment. Không tự thêm lời gọi vào module của Hiếu/Khoa trong #36.

### Người dùng tự kiểm tra Gmail thật sau này

1. Bật [Google 2-Step Verification và tạo App Password](https://support.google.com/mail/answer/185833?hl=en). Dán App Password vào `backend/.env` cục bộ; dùng tài khoản Gmail tương ứng cho `GMAIL_USER`, bật `NOTIFICATIONS_ENABLED=true`. `.env` đã bị gitignore; không đưa secret vào commit/PR/log.
2. Trong `backend/`: `npm run build`, sau đó chủ động chạy `npm run notify:test -- dia-chi-nhan@example.com`. Script dùng chính NotificationsService, buộc đúng một người nhận và enabled/config hợp lệ, chờ drain rồi đóng application context (không kết nối Mongo). Schema env chung vẫn yêu cầu MONGODB_URI hợp lệ. Mẫu gửi là booking cancellation có mã `H9-TEST-KHONG-PHAI-BOOKING-THAT`, chỉ phục vụ thử cấu hình.
3. Xem log đã che và hộp thư người nhận; script thông báo queue drained không có nghĩa thư đã tới inbox. Có thể bị Gmail chặn/quota/spam. [Nodemailer Gmail guide](https://nodemailer.com/guides/using-gmail) mô tả giới hạn gửi và các nguyên nhân bị chặn; quota tùy loại tài khoản, không hard-code trong H9.

**Không chạy script/gửi Gmail thật trong quá trình #36, test hoặc CI.** Tất cả test dùng fake/jsonTransport không mạng. Local Docker được miễn theo yêu cầu thường trực của người dùng; không tuyên bố đã chạy Docker tại máy.

### Kiểm chứng và dependency

Baseline main: backend lint/typecheck, 779 unit tests pass. Audit production trước thay đổi có 3 high trong chuỗi NestJS → multer (audit cả dev thêm @nestjs/testing, tổng 4 high có sẵn); không sửa dependency ngoài scope.
Pin chính xác Nodemailer **10.2.1** (22/10/2026) và @types/nodemailer **8.0.2** (15/09/2026). Người dùng đã chấp thuận dùng 10.2.1 đã vá và miễn điều kiện tuổi phiên bản >2 tuần cho Nodemailer: bản 10.0.16 đáp ứng tuổi nhưng có 3 advisory parser, bản vá đầu tiên 10.1.4 mới phát hành 18/10. Không chạy audit fix/force. Kết quả audit cuối ghi bên dưới.

Audit cuối (10.2.1): **0 finding cho Nodemailer/dependency mới**; audit toàn cây vẫn exit 1 vì 4 high có sẵn (`@nestjs/core`, `@nestjs/platform-express`, `@nestjs/testing`, `multer`), không phát sinh vulnerability mới. Kiểm tra cuối: lint không warning, format:check, typecheck, build pass; 51 H9 unit test pass; e2e AppModule thật **252/252** (29 file) pass. Script `notify:test` đã build ra entry point nhưng tuyệt đối không chạy; Gmail thật chưa kiểm chứng. Bộ unit toàn backend trên code cuối với cache tắt: **830/830 pass** (34 file). Commit code `e864bab`, test `d04b848`.
PR: [#29 — H9 Gmail notification](https://github.com/duongvn9/hotel-mangagement-system/pull/29). Quy trình xuất bản: chỉ merge bằng merge commit sau khi Backend, Frontend và Docker Images trên head cuối xanh; tiêu đề merge dùng "Merge pull request #29 from duongvn9/feature/36-gmail-notification". Xem PR để biết trạng thái CI/merge thực tế.

<a id="uc35"></a>
## #37 / UC35 — Report Equipment Fault / Damage (24/10/2026)

### Bước 0 và quyết định đã xác nhận

Baseline `main@e568713`, nhánh `feature/37-equipment-fault-report`. Task core #64 đã merge: `TasksService.create(input: CreateTaskDto, identity?: Types.ObjectId)`; input title/taskType/priority/sourceType/sourceId/assigneeId/dueAt?. Assignee bắt buộc, trạng thái ASSIGNED → IN_PROGRESS → COMPLETED, không PENDING. taskType/priority là string, không có TaskType enum. Task.sourceId không khai báo refPath; TasksService kiểm tra `_id` thật qua `connection.collection(TASK_SOURCE_COLLECTIONS[sourceType])`. Nguồn MAINTENANCE ánh xạ chính xác tới `maintenances`.

Issue đã có nhưng `IssuesService.create(dto, userId)` bắt buộc booking thuộc Customer qua IssueContextAdapter, có quy trình duyệt riêng trước giao Task. Theo quyết định mới của người dùng: **không tạo Issue, không mở rộng/sửa schema/service/module Issue**, dùng model `Maintenance`, collection `maintenances`, nguồn Task `MAINTENANCE`. Đây là **entity ngoài ERD gốc, nâng tổng số lên 17 entity; cần nhóm xác nhận**. Phương án mở rộng Issue trước đó đã hủy.

RoomsModule export model Room và RoomsService; status hiện có AVAILABLE/OCCUPIED/CLEANING/MAINTENANCE. UC35 dùng model Room export để cập nhật status nguyên tử có điều kiện, không thay hàm update phòng chung.

### Schema / provider / seed

- `common/constants/equipment-condition.enum.ts`: EquipmentCondition GOOD / FAULTY / UNDER_REPAIR (giả định ERD chưa liệt kê giá trị).
- Equipment, collection `equipment`: assetCode trim required unique, name/category trim required, location optional, condition mặc định GOOD, room optional ref Room, isActive default true, timestamps. EquipmentModule export MongooseModule và EquipmentService. **Equipment chỉ có seed, không CRUD/endpoint quản lý**.
- Maintenance, collection `maintenances`: reportedBy ref User, room/equipment/facilityLocation optional, description trim 1–2000, requiresAction default true, preventsSafeUse default false, task ref Task được đặt sau khi Task tồn tại, timestamps. Không status/completedAt và không sửa/xóa qua HTTP.
- Có thêm metadata kỹ thuật để gửi lại an toàn: requestKey, requestFingerprint (SHA-256 payload chuẩn hóa), taskIdentity (ObjectId cố định lưu trước khi tạo Task), receipt (kết quả hoàn tất ghi nhận). **Receipt không phải trạng thái hoàn thành công việc**. Unique index reportedBy + requestKey chống tạo bản ghi trùng; dữ liệu mô tả/đối tượng/người báo immutable.
- MaintenanceModule import EquipmentModule, RoomsModule, TasksModule và schema User sẵn có; export MaintenanceService/MongooseModule. Không import Issue/Bookings/Notifications, không forwardRef. AppModule đăng ký EquipmentModule/MaintenanceModule.
- Seed registry: roles → users → amenities → room-types → rooms → **equipment** → services → bookings → feedback. 7 thiết bị mẫu: điều hòa, TV, két sắt, bình nóng lạnh gắn phòng; thang máy, máy phát, bơm nước cơ sở chung, một thiết bị inactive. Seed `$setOnInsert` + upsert; không đổi edited fields/timestamps/version; thiếu phòng theo roomNumber thì bỏ qua dòng tương ứng.

### API / luồng ghi / retry

| Endpoint | Hợp đồng |
|---|---|
| GET `/api/v1/maintenance/targets?q=` | Active rooms/equipment; tìm kiếm không phân biệt hoa thường, escape regex, q tối đa 100 ký tự, tối đa 20 mỗi nhóm, sort ổn định; equipment kèm roomId/roomNumber |
| POST `/api/v1/maintenance/reports` | Body roomId?, equipmentId?, facilityLocation? (trim ≤200), description (trim 1–2000), requiresAction? (true), preventsSafeUse? (false). 201: reportId, taskId? và roomMarkedUnavailable/warnings |

Chỉ `@Roles(Role.OperationsStaff)`, không gắn permission. Seed role có `issue:report` cho Customer/Service Staff/Operations Staff; gắn permission OR role sẽ mở rộng sai quyền. BE chặn các role khác 403, anonymous 401; service còn kiểm tra User thật active Operations Staff. FE RequireAuth cũng chỉ role vận hành.

1. Validate DTO/field lạ, actor active, ít nhất một đối tượng/vị trí + mô tả, target tồn tại active, equipment/room không mâu thuẫn; equipment-only tự suy ra phòng của nó. preventsSafeUse bắt buộc có phòng và requiresAction=true. Không ghi dữ liệu nghiệp vụ nếu validation đầu vào thất bại.
2. Header `Idempotency-Key` là UUID: FE tự tạo và giữ nguyên cho mọi lần retry một báo cáo; optional cho caller tạo mới, server sinh UUID nếu thiếu. **Caller tích hợp muốn retry an toàn phải giữ và gửi lại cùng UUID**, không tạo UUID mới. Cùng key + payload khác trả 409; unique key theo reportedBy. Nội dung ID chuẩn hóa lowercase, chuỗi trim và boolean defaults trước khi hash.
3. Ghi Maintenance cùng durable taskIdentity trước; nếu requiresAction thì gọi chính `TasksService.create(dto, taskIdentity)`, sourceType MAINTENANCE/sourceId Maintenance._id, **taskType MAINTENANCE**, **priority URGENT nếu preventsSafeUse, ngược lại NORMAL**, assignee chính Operations Staff báo cáo (giả định đã được người dùng chỉ định; cần nhóm chốt). Không ghi trực tiếp Task model. Lookup Task qua `TasksService.findAssigned(actorId, taskIdentity)` trước khi tạo; lỗi create không rõ đã commit thì đối chiếu lại sourceId/type/priority. Giữ cùng identity cả khi Task đã COMPLETED, không tạo công việc mới khi retry.
4. Sau khi có Task, đặt Maintenance.task; Equipment chỉ GOOD → FAULTY bằng update có điều kiện, giữ UNDER_REPAIR/FAULTY.
5. preventsSafeUse=true: `findOneAndUpdate` Room active + status thuộc AVAILABLE/CLEANING → MAINTENANCE. Đã MAINTENANCE thì giữ nguyên/true. OCCUPIED không bị ghi đè, trả false và warning “Phòng đang có khách; cần lễ tân xử lý”. preventsSafeUse=false không cập nhật Room.
6. Ghi receipt cuối cùng. Replay receipt không chạy lại side effects, nên không đưa phòng đã được phục hồi thủ công về MAINTENANCE lần nữa. Lỗi sau khi Maintenance đã lưu trả **503**, message chứa reportId; log error có reportId, không báo thành công im lặng. Retry cùng key/payload tiếp tục cùng report/Task. FE khóa nội dung khi kết quả chưa rõ, giữ key và có nút Gửi lại; lỗi validation/auth trước ghi cho phép sửa dữ liệu.

Mongo dev/CI dùng mongo:8 standalone, không cấu hình replSet/replicaSet; code UC35 không session/transaction. Ghi nhiều collection không atomic: Maintenance/Task hoặc một side effect có thể đã tồn tại khi trả 503, cần retry; target có thể bị thay đổi giữa các bước do writer khác. Không có worker tự phục hồi nếu người dùng không retry. Khóa UUID trong form giữ trong phiên component, refresh/đóng tab không tự phục hồi khóa; API caller cần tự lưu key nếu cần retry sau reload.

BR-MNT-04 kiểm chứng qua H6 thật: phòng MAINTENANCE bị loại khỏi available rooms. Không ghi đè OCCUPIED: lễ tân phải xử lý tình trạng an toàn của phòng đang có khách. Không tự phục hồi phòng khi Task hoàn thành; thuộc luồng hoàn thành/đóng hoặc Manager UC48, ngoài #37. Không notification.

### Frontend và điểm mở rộng #38

Route `/operations/maintenance/report`, fallback PublicLayout theo router hiện tại vì H10 chưa có layout riêng; UserMenu chỉ Operations Staff có “Báo hỏng thiết bị”. Form chọn Phòng/Thiết bị/Cơ sở khác, search debounce 250ms, hiện phòng của thiết bị, mô tả đếm 2000 ký tự, required/focus/aria errors; safe-use tự bật/khóa requiresAction. Loading/error/retry/empty search, pending chống double submit, giữ dữ liệu khi lỗi; xác nhận report/Task/phòng/warnings và nút báo cáo vấn đề khác, không link chết sang UC36. Dùng component/token chung, không Lucide/hex mới.

#38/UC36 có thể import MaintenanceModule để đọc Maintenance và liên kết task; trạng thái hoàn thành phải lấy từ Task, **không suy ra từ receipt**. Chưa tạo API lịch sử hay tự quyết scope quyền lịch sử.

### Kiểm chứng

Baseline main: BE/FE lint và typecheck pass. Backend unit lượt baseline: 778 pass, 60 skipped vì beforeAll `issues.http.spec.ts` timeout 10000ms; frontend: 281 pass/21 file, hai worker Service Order không khởi động (Vitest pool timeout). Không sửa code/config các module đó. Các lượt kiểm tra cuối dùng thời hạn hook phù hợp và runner frontend forks; kết quả cuối sẽ ghi bên dưới. Local Docker được miễn theo yêu cầu thường trực; không chạy Docker tại máy.

### Tiếp tục và bàn giao UC35 — 25/10/2026

- Code UC35 đã commit `790bd50`; tích hợp `origin/main@ce994d8` bằng merge commit `ffb2ae5`. Xung đột UserMenu đã giải quyết để giữ cả lịch sử dịch vụ trên main và mục báo hỏng cho Operations Staff. Worktree chính đã đồng bộ bản tích hợp, không còn các file untracked do lượt merge Windows thất bại.
- Trước tích hợp: lint/format/typecheck BE và FE pass; backend **871/871** unit tests, frontend **355/355** tests pass. UC35 **22/22 e2e** pass. Toàn e2e nền cũ **293/294** pass; lỗi H5 kiểm tra seed không tồn tại trong DB dùng chung. Main mới có thay đổi seed/test H5, nên chạy lại toàn bộ trên bản tích hợp thay vì miễn lỗi.
- Cách chạy giới hạn tài nguyên: backend `npm test -- --maxWorkers=2 --hookTimeout=60000 --testTimeout=15000`; frontend `npm test -- --pool=forks --maxWorkers=2 --testTimeout=15000`; e2e `npm run test:e2e -- --hookTimeout=60000 --testTimeout=15000`. MongoDB cục bộ riêng, DB `hms_uc35_integrated_test`, không dùng DB dev. Không thay config runner của dự án chỉ để tránh timeout tại máy.
- Build BE trước tích hợp pass. Build FE trước tích hợp pass với `npx vite build --outDir .uc35-build` sau typecheck, do Windows chặn dọn `frontend/dist/assets`; thư mục build tạm đã được xóa. Kiểm tra bản tích hợp dùng thư mục worktree riêng để chạy lệnh build chuẩn.
- Bản tích hợp `ffb2ae5`: BE/FE lint, format:check, typecheck và build chuẩn đều pass. Backend **883/883 tests** (38 file) pass. Frontend toàn bộ **406/407 tests** (27 file), một ca Booking timeout khi chờ heading Deluxe, DOM còn loading; chạy lại riêng toàn file Booking bằng `--pool=forks --maxWorkers=1 --testTimeout=15000` thì **6/6 pass** trong 5,65 giây, không sửa code/config Booking. Không gọi lượt toàn frontend là xanh hoàn toàn; UC35 vẫn pass trong lượt toàn bộ.
- E2e toàn bản tích hợp: **348/348 tests, 33/33 file pass** trên MongoDB thật, gồm UC35 và H5 seed; không còn lỗi H5 của nền cũ. Local build chuẩn BE/FE pass; frontend chỉ còn cảnh báo bundle lớn hơn 500 kB. Không phát sinh thay đổi code ngoài UC35 so với main (ngoại trừ cập nhật kỳ vọng seed registry trong test Service).
- Bằng chứng từ lượt trước 24/10 (không tuyên bố chạy lại ngày 25/10): `.task29-validation/uc35-browser-result.json` ghi nhận API/Swagger thật, form mobile 375px không tràn, desktop 1440px, validation focus, safe-use khóa action, xác nhận report/Task/bảo trì và cơ sở chung không Task, menu Operations, không runtime errors. `.task29-validation/uc35-seed-result.json` ghi seed CLI hai lần, 7 thiết bị (4 gắn phòng, 3 cơ sở chung), giữ edited fields/timestamps/version. Các artifact kiểm chứng không commit.
- Nhánh `feature/37-equipment-fault-report`; [PR #35](https://github.com/duongvn9/hotel-mangagement-system/pull/35) đã merge bằng merge commit `d5f422c`, sau khi backend/frontend/Docker CI xanh trên `900ff32`. Main cục bộ đã đồng bộ và sạch. Người dùng đã ủy quyền rõ ngày 25/10: tự tạo nhánh/PR và merge khi hoàn tất kiểm chứng, không hỏi lại từng việc. Không chạy Docker tại máy.
- Handoff #38/UC36: dùng `MaintenanceModule`, lấy trạng thái hoàn thành từ Task; không dùng receipt làm trạng thái công việc. Không tự phục hồi phòng khi hoàn thành Task. Nhóm vẫn cần xác nhận entity Maintenance ngoài ERD và chính sách giao Task cho người báo như phần quyết định phía trên.

<a id="uc36"></a>
## #38 / UC36 — View Maintenance History (25/10/2026)

### Ngày / baseline / phạm vi

Baseline `main@d5f422c`, đã pull trước khi tạo `feature/38-maintenance-history`. Kiểm tra UC35 đã merge và đọc schema/module thực tế trước triển khai. Baseline BE/FE lint/typecheck pass, backend **883/883**, frontend **407/407 tests pass**. Chức năng UC36 chỉ đọc; không sửa Task/Issue/Booking/Room/Equipment hoặc tạo hệ Task thứ hai.

### API / DTO / phạm vi / trạng thái

- `MaintenanceHistoryController` có GET `/api/v1/maintenance/history` và GET `/api/v1/maintenance/history/:id`, Swagger có response schema chi tiết. Chỉ `@Roles(Role.OperationsStaff)`, không `@Permissions`; anonymous 401, Customer/Receptionist/Service Staff/Manager 403. Không có endpoint ghi dưới history. ID sai 400; không tồn tại/ngoài phạm vi cùng 404 và cùng message, giữ error filter chuẩn (path gồm query nếu có).
- `MaintenanceHistoryQuery`: q literal case-insensitive, trim, tối đa 100; status ASSIGNED/IN_PROGRESS/COMPLETED/NO_ACTION; from/to YYYY-MM-DD hợp lệ theo lịch; page >=1 mặc định 1; limit 1–100 mặc định 10; `sort=asc|desc` theo reportedAt, mặc định desc, thêm `_id` cùng chiều để ổn định. Field lạ/sai trả 400. `reportedAt` là `Maintenance.createdAt`; không thêm field thời gian trùng vào schema.
- Quyết định phạm vi cần nhóm xác nhận: **reportedBy = actor HOẶC taskData.assignedTo = actor**. Một hàm `maintenanceHistoryScope()` duy nhất dùng trong pipeline chung cho list/detail; `$match` trong MongoDB, không lấy dữ liệu người khác về rồi lọc trong ứng dụng. Liên kết Task được kiểm tra thêm `sourceType=MAINTENANCE`, `sourceId=Maintenance._id`, tránh cấp phạm vi qua link dữ liệu hỏng. Giữ cả bản ghi chưa hoàn thành và hoàn thành trong phạm vi.
- Một aggregation mỗi request; `$lookup` Task/Room/Equipment và (chi tiết) User, `$facet` items/count sau scope/status/q/date. Không N+1; total cùng bộ lọc với items. Description API trả đầy đủ tối đa 2000 ký tự; UI rút gọn trong bảng bằng truncate, tooltip/focus và hiển thị đầy đủ ở chi tiết.
- Task thật dùng **assignedTo**, không phải assigneeId; không có startedAt nên không bịa trường này. Task là nguồn trạng thái ASSIGNED/IN_PROGRESS/COMPLETED, completedAt/workResult. requiresAction=false -> NO_ACTION. Không suy trạng thái từ receipt; không lưu status/completedAt vào Maintenance. Task thiếu/hỏng/không có trạng thái hợp lệ -> **status=null** (UI “Không xác định”), log `maintenance_history_missing_task` với reportId; không cho lọt bộ lọc trạng thái hợp lệ. Room/Equipment bị mất -> target tương ứng null. Người dùng bị mất -> giữ ID và nhãn “Không còn tài khoản”. Chi tiết người báo/người thực hiện chỉ trả id/fullName, không trả email/phone.
- Ngày nghiệp vụ dùng helper chung `toBusinessDate` để kiểm tra ngày Việt Nam, cùng ranh giới +07:00 như H6; from/to là ngày gồm cả ngày cuối, chuyển thành khoảng nửa mở `[from 00:00 VN, ngày sau to 00:00 VN)`. from > to hoặc ngày như 30/02 trả 400. UI hiển thị dd/MM/yyyy HH:mm với timezone Asia/Ho_Chi_Minh, không phụ thuộc timezone máy.

### Schema / provider / seed / route

- Chỉ thêm index trên Maintenance: `{ reportedBy: 1, createdAt: -1 }` và `{ task: 1 }`; giữ các index cũ. `TasksModule` chỉ export TasksService; `MaintenanceModule` đăng ký lại **chính TaskSchema hiện có** qua MongooseModule.forFeature để aggregation chỉ đọc lấy collection Task, không sửa module/schema/service của Vũ, không vòng phụ thuộc.
- `seedMaintenance` sau users/rooms/equipment. Registry: roles → users → amenities → room-types → rooms → equipment → **maintenance** → services → bookings → feedback. Ba quan sát mẫu cho `operations@hms.local`: điều hòa 102, thang máy, sảnh. Chỉ requiresAction=false/NO_ACTION, không tạo Task trực tiếp. Thiếu actor/đối tượng phụ thuộc thì bỏ qua; khóa reportedBy/requestKey UUID cố định, `$setOnInsert` + upsert và `timestamps:false` giữ chỉnh sửa/timestamps/version khi seed lại. Test registry Service được cập nhật theo dependency mới, không sửa logic Service.
- Frontend giữ layout PublicLayout/menu hiện có của UC35; route `/operations/maintenance/history` và `/:id`, RequireAuth chỉ Operations Staff. Menu “Lịch sử bảo trì”; màn xác nhận UC35 có link “Xem lịch sử bảo trì” và invalidate cache lịch sử sau báo cáo thành công. Danh sách có debounce 300ms, status/ngày/sort, phân trang; filter/page ở URL và được giữ khi back/refresh chi tiết. Ngày nhập dd/MM/yyyy, chặn sai ngày/khoảng ở client, không gửi query cũ khi URL chưa ổn định.
- Loading/error/thử lại, rỗng trong phạm vi và rỗng do lọc tách thông báo. Link thật trong bảng dùng được bằng Enter, bảng cuộn trong container ở 375px, vùng chạm link 44px. Chi tiết COMPLETED có kết quả/người thực hiện/thời điểm và nhãn “Bản ghi lịch sử, chỉ xem”; thiếu/ngoài scope có thông báo chung và link quay lại. Không có form/nút sửa, xóa, hoàn thành hoặc giao lại.

### Kiểm chứng / artifact

- Riêng UC36: **12 unit backend, 25 e2e, 18 frontend tests pass**; feature maintenance gồm cả UC35 **33/33 frontend tests pass**. Bao phủ scope A/B trên list/detail, status/NO_ACTION/mồ côi, literal q/total, ranh giới ngày, pagination/sort, 401/403/400/404, privacy, chỉ mục, một aggregate mỗi request, seed idempotent, Swagger thật và snapshot read-only Maintenance/Task/Room/Equipment qua nhiều GET. Task fixture tạo/chuyển trạng thái qua TasksService thật.
- CLI `npm run seed` đã chạy **hai lần** trên `hms_uc36_cli_test`, kiểm tra ba bản ghi mẫu, sửa fixture sau lần đầu và so sánh sau lần hai giữ nguyên data/timestamps/version. Script `backend/test/maintenance-history.smoke.mjs` chỉ dành DB test, không import vào production. API/Swagger list/detail thật đã kiểm chứng, chỉ trả id/fullName và không làm đổi snapshot.
- Trình duyệt thật API/Vite: `.task29-validation/uc36-browser-result.json`, `uc36-history-mobile-375.png`, `uc36-detail-mobile-375.png`, `uc36-history-desktop.png`; 375px documentWidth=375, 1440px documentWidth=1440, một H1, link 44px, Enter mở chi tiết, giữ filter khi quay lại, refresh chi tiết trực tiếp, scoped 404, không write controls/runtime errors. Bản ghi hoàn thành trong smoke được tạo qua UC35 và chuyển trạng thái qua Task API thật trên DB test riêng. Không commit các artifact này.
- Docker CLI/Desktop không có tại máy (đã kiểm tra lệnh và đường dẫn cài chuẩn), nên không tuyên bố local Compose pass. Bổ sung job CI `maintenance-smoke` trên ubuntu-22.04: `docker compose up --build -d --wait`, health backend/frontend proxy, `npm run seed` hai lần, smoke list/detail/Swagger/idempotency và dọn volume test. Chỉ merge sau khi job này cùng backend/frontend/Docker production xanh.
- Toàn repo trên code cuối: **backend 895/895 unit tests (39 file), e2e 373/373 (34 file), frontend 425/425 (28 file) pass**. BE/FE lint (không warning), format:check, typecheck và build chuẩn đều pass. Lượt frontend chạy chung ban đầu 424/425, một test Service Order timeout khi chờ danh sách nhân viên; sau khi dừng preview helpers, chạy lại toàn frontend với `--pool=forks --maxWorkers=1 --testTimeout=15000` đạt 425/425, không sửa code/config module đó. Backend dùng maxWorkers=2/hookTimeout=60000/testTimeout=15000; e2e chạy tuần tự với hookTimeout=60000/testTimeout=15000 trên DB `hms_uc36_full_test`, không dùng DB dev. Build FE còn cảnh báo bundle lớn hơn 500 kB có sẵn.
- Commit API/seed/unit `577f69e`, frontend `18bbdd9`, e2e/Compose CI `3840912`; nhánh `feature/38-maintenance-history`, [PR #36 — feat(maintenance): UC36 view maintenance history (#38)](https://github.com/duongvn9/hotel-mangagement-system/pull/36). Xem PR để đối chiếu kết quả CI runtime và merge commit thực tế. Theo ủy quyền thường trực, chủ động merge bằng merge commit sau khi toàn bộ CI (backend, frontend, production Docker, maintenance-smoke) xanh; không coi kết quả local là thay thế Compose runtime.

### Giả định / giới hạn / mở khóa #42

Phạm vi reporter HOẶC assignee và trạng thái NO_ACTION/null là quyết định triển khai, cần nhóm xác nhận; chưa phải business rule được nhóm phê duyệt. Seed chỉ có quan sát không Task; hoàn thành có completedAt/workResult được chứng minh bằng test và smoke qua Task thật. Không thêm sharing giữa nhân viên, chi phí, CSV, xóa/lưu trữ hoặc cập nhật lịch sử. Không có TODO/mock chặn UC36 trong production.

#42 có thể tái dùng schema Maintenance (`createdAt` là reportedAt), liên kết Task và hàm phạm vi nếu actor/quyền báo cáo trùng; KPI toàn khách sạn hoặc scope Manager cần đặc tả riêng, không tái sử dụng quyền Operations Staff một cách ngầm định. Không suy ra hoàn thành từ receipt hoặc tự khôi phục Room từ lịch sử. Không gửi notification.

<a id="uc55"></a>
## #40 — UC55 Monitor Task Queues

Baseline main `62b548c`, nhánh `feature/40-task-queue-monitor`. Task core #64 đã có; chưa có API Manager giám sát tương đương. Module mới `task-supervision` chỉ đọc, không sửa module tasks của Vũ hoặc nghiệp vụ Issue/Service Order/Booking/Invoice/Payment.

### Hợp đồng thực tế và khác biệt so với prompt

- Task dùng `assignedTo`: schema đọc, aggregation và lookup đều dùng tên này. Tham số API vẫn là `assigneeId`, chuyển sang ObjectId của `assignedTo` khi lọc.
- Chỉ có ASSIGNED / IN_PROGRESS / COMPLETED, không thêm PENDING. Không có startedAt nên không tự dựng trường này. Nhãn trạng thái/nguồn FE được test đối chiếu hợp đồng BE thật.
- `priority` là string có trim, không normalize chữ hoa/thường hoặc collation. Lọc bằng equality **phân biệt hoa thường**, ký tự regex được hiểu nguyên văn. DTO chỉ kiểm tra chuỗi không rỗng, tối đa 100 ký tự; không IsEnum hoặc TaskPriority.
- `/summary` trả `facets.priorities` và `facets.taskTypes` distinct từ dữ liệu trong phạm vi quản lý, độc lập các filter hiện chọn để có thể đổi lựa chọn. Frontend dùng các facets này, không hardcode danh sách ưu tiên.
- Sort chỉ `assignedAt|dueAt|completedAt`; `priority` trả 400. Cả hai chiều đều null cuối, có `_id` làm tiêu chí phụ ổn định. Không tự dựng bảng xếp hạng ưu tiên.
- Nhãn priority chỉ để hiển thị: LOW=Thấp, NORMAL=Bình thường, HIGH=Cao, URGENT=Khẩn cấp; giá trị lạ giữ nguyên chuỗi, thiếu hiện “—”. Không ép khớp enum BE.

### API, phạm vi và tính nhất quán

Ba GET `/api/v1/task-queues/summary`, `/tasks`, `/tasks/:id`, chỉ Manager ở BE và FE. Không dùng permission chung để tránh cơ chế OR mở quyền cho nhân viên. Module đăng ký lại đúng TaskSchema hiện hữu để đọc; không tạo schema Task khác, không vòng phụ thuộc.

Mỗi endpoint thực hiện một aggregation mới, không cache hoặc lưu counts/overdue/workload. Hàm scope chung `taskSupervisionScope()` hiện là toàn bộ Task của khách sạn, được áp dụng cả summary/list/detail. Clock inject được: quá hạn khi dueAt là Date, nhỏ hơn now và status khác COMPLETED. Counts có assigned/inProgress/completed/other/total; other dành cho dữ liệu legacy bất thường, bình thường bằng 0. Summary không nhận status/overdue; hai filter này chỉ dành cho bảng.

Workload nhóm theo assignedTo, xếp số việc mở giảm dần, giới hạn 100 người trước lookup; tổng summary vẫn tính toàn bộ. User projection chỉ id/fullName/role; thiếu user trả null và log cảnh báo ID, không làm lỗi danh sách. List facet items/total cùng bộ lọc, lookup sau phân trang. Detail trả workResult khi hoàn thành; MAINTENANCE có summary Room/Equipment tối thiểu, ISSUE/SERVICE_ORDER chỉ trả tham chiếu nguồn, không kéo module ngoài phạm vi.

Không thay index Task hiện hữu (`assignedTo,status`; `status`; `sourceType,sourceId`; unique active source/taskType). Khi dữ liệu lớn cần Vũ đánh giá explain cho `{status:1,dueAt:1,_id:1}` hoặc `{assignedTo:1,status:1,dueAt:1}`; không khẳng định index giải quyết sort null cuối hoặc facets toàn scope.

### Frontend và bàn giao tái sử dụng

Routes `/manager/task-queues` và `/:id` dưới PublicLayout/menu Manager hiện có. Ba tab có counts, roving tabindex, phím mũi tên/Home/End; một H1, link thật mở chi tiết bằng Enter. Bộ lọc, trang và sort lưu URL, giữ khi back/refresh. Tìm tiêu đề debounce 300ms; dropdown ưu tiên lấy facets, chọn người từ workload. Checkbox quá hạn chỉ lọc bảng, có giải thích phạm vi counts.

Counts và workload dùng chung một response summary để cùng snapshot, bảng tải riêng. Mỗi khối có loading/error/thử lại; rỗng toàn bộ, rỗng do lọc và rỗng hàng đợi tách biệt. Filter đang tải giữ facets cũ và báo đang cập nhật. staleTime=0, refetch khi focus hoặc bấm Làm mới; không polling. generatedAt và aria-live báo snapshot. Ngày hiển thị dd/MM/yyyy HH:mm Việt Nam, bảng cuộn trong container ở 375px. Chi tiết chỉ xem, không có sửa/giao lại/hoàn thành.

`TaskSupervisionService.summary/list/detail`, scope và DTO có thể tái sử dụng cho #39/#42 sau khi thống nhất quyền/phạm vi. Báo cáo KPI/ngày và mở rộng nguồn cần hợp đồng riêng, không ngầm dùng scope Manager cho nhân viên.

### Kiểm chứng

Các lượt tập trung ban đầu: backend **21 unit**, **27 e2e**, frontend **32 test** pass. Có test exact priority chứa regex, facets theo dữ liệu, sort priority 400, ba trạng thái thật, priority lạ/thiếu; kiểm tra chuyển trạng thái qua TasksService thật cập nhật summary ngay và GET không ghi dữ liệu/collection mới. Baseline trước thay đổi: BE 895 unit, FE 425 test pass. Lượt regression chạy đồng thời bị timeout cả các module có sẵn; không coi các lượt đó là pass, đang chạy lại tuần tự.

Seed chuẩn đã chạy thành công hai lần trên DB riêng `hms_uc55_cli_test`; không bổ sung Task seed và không tạo Task trực tiếp trong production seed. `backend/test/task-supervision.smoke.mjs` giới hạn DB test, tạo fixture qua UC35/Task API thật để kiểm tra vòng đời và tính chỉ đọc. CI `maintenance-smoke` được mở rộng chạy smoke UC55 sau Compose/seed hai lần. Máy local không có Docker CLI/Desktop; chỉ coi Compose runtime đạt khi job CI này xanh, cùng backend/frontend/production Docker trước merge.

### Giả định

Priority là chuỗi tự do theo hợp đồng Task hiện tại; **không có thứ tự ưu tiên cố định**. Nếu nhóm muốn sort theo mức ưu tiên, cần Vũ chốt enum và thứ tự trước. Scope Manager toàn Task một khách sạn, workload và overdue là giả định triển khai/mở rộng cần nhóm xác nhận; chưa phải business rule mới được phê duyệt. Không thêm TaskPriority, không sửa module tasks của Vũ.
