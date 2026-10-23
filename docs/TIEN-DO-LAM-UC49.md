# Bàn giao #28 — UC49 View Room Type List

> Triển khai cho Trần Bảo Lâm từ main `9a0fb22`, nhánh `feature/28-room-type-list`.
> Code và kiểm tra cục bộ đã hoàn tất; lỗi format đã sửa, Docker được miễn theo yêu cầu. Xem cập nhật mới nhất ở cuối tài liệu.

> Xác nhận khi bắt đầu UC50 ngày 23/10/2026: UC49 đã merge main qua `4134194`. Bàn giao tiếp theo: [UC50 — tạo/sửa loại phòng](TIEN-DO-LAM-UC50.md). Các trạng thái “chưa merge” bên dưới là lịch sử trước thời điểm xuất bản UC49.

## Phạm vi

- Backend đọc danh sách RoomType thật từ MongoDB, có schema Amenity tối thiểu.
- Frontend `/manager/room-types`, menu Manager, phân quyền và các trạng thái dữ liệu.
- Không có thao tác thêm/sửa/xóa, schema Room/RoomStatus, adapter H6 hoặc thay đổi invoice.
- Header hiện có chỉ được cho phép xuống dòng ở màn hẹp để menu mới không ép chiều ngang; không tạo layout theo role.

## API

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

## Schema và module export

- `Amenity` / `AmenitySchema`: collection `amenities`; name required/trim/unique, description mặc định rỗng, isActive mặc định true, timestamps.
- `RoomType` / `RoomTypeSchema`: collection `roomtypes`; name required/trim/unique, description, capacity, basePrice, amenities ObjectId[] ref Amenity không trùng, isActive, timestamps.
- Unique name là index MongoDB, không phải validator Mongoose; không thêm unique không phân biệt hoa thường.
- `AmenitiesModule` export MongooseModule.
- `RoomTypesModule` export MongooseModule và RoomTypesService.
- Tên model/ref ổn định: `RoomType`, `Amenity`.
- Trong UC49 chỉ đọc, schema ref không tự bảo đảm tồn tại đối tượng tham chiếu khi một module khác ghi trực tiếp. Task #29 phải kiểm tra references hợp lệ ở service ghi dữ liệu.

## Seed

Thứ tự: `roles → users → amenities → room-types → bookings → feedback`.

- Amenity: Wi-Fi, Điều hòa, Bồn tắm.
- RoomType: Standard (850.000 VND, 2 khách), Deluxe (1.500.000 VND, 3 khách), Suite (2.800.000 VND, 4 khách, inactive).
- Upsert theo name với $setOnInsert, không ghi đè dữ liệu đã sửa.
- Không tạo Room giả để seed Booking. Seed Booking cũ vẫn bỏ qua nếu collection rooms chưa có Room active.
- Seed Feedback cũ giữ nguyên; task này không đổi tham chiếu booking của Feedback.

## Frontend

- Feature: `frontend/src/features/room-types/`.
- API qua client chung, query key `['room-types', query]`.
- Search debounce 300ms, thay search/status reset page về 1; chuyển trang giữ filter.
- Bảng hiển thị đủ 6 cột; tiền qua Intl vi-VN/VND, tiện nghi có chip và details khi > 3.
- Loading, lỗi + thử lại, chưa có dữ liệu và không khớp bộ lọc tách biệt.
- Route dùng RequireAuth cùng roles/permissions với backend.
- Bảng cuộn trong container, label và caption cho accessibility. Không có nút CRUD hoặc dữ liệu mock production.

## Kế thừa cho task sau

**#29/UC50:** tái sử dụng schema/module/API feature, bổ sung DTO/service/controller mutation và form; kiểm tra references Amenity, invalidation query room-types. Không cần tạo schema RoomType/Amenity thứ hai.

**#30–31 và H6:** import RoomTypesModule để dùng model. capacity nằm ở RoomType. Chưa có Room/RoomStatus; chưa có provider nguồn phòng thật cho H6. Việc nối availability và pricing thuộc prompt riêng, không coi UC49 là hoàn thành H3 toàn bộ.

**#32–33:** tái sử dụng Amenity schema và AmenitiesModule, quan hệ một chiều RoomType.amenities. Task này chưa có API Amenity.

## Quy ước Git người dùng yêu cầu từ task này

- Mỗi chức năng tạo nhánh từ main mới nhất: feature/<task>[-<task>]-<slug>.
- Lỗi phát sinh tạo nhánh fix/<task>-<slug> từ nhánh chức năng hoặc main nếu đã merge.
- Commit Conventional Commits nhỏ theo phạm vi.
- Chỉ push/PR/merge khi đủ scope và tất cả check bắt buộc pass. Merge commit, không force-push, không tự sửa Jira/nhánh người khác.
- Nếu baseline main đỏ: ghi rõ lỗi có sẵn, không sửa ngoài phạm vi. Không merge khi còn check đỏ hoặc chưa chạy.
- User đã cho phép push/PR/merge trong prompt #28 nhưng có điều kiện kiểm tra trên; không cần hỏi lại khi đã đủ điều kiện.

## Kết quả kiểm tra thực tế và trạng thái bàn giao (23/10/2026)

**Code đã hoàn thành cục bộ; chưa push, mở PR hoặc merge vào main.**

- Nhánh chức năng: `feature/28-room-type-list`.
- Nhánh sửa lỗi: `fix/28-room-type-tests`, đã merge cục bộ về feature bằng merge commit.
- Commit triển khai: `281be44`; format: `bb27ca4`; sửa test/menu: `e9bab49`; cô lập seed test: `94f5db5`.
- Merge fix vào feature cục bộ: `c1800cc`; chưa có PR/commit merge vào main.
- Main vẫn ở `9a0fb22`. Không thay đổi source hoặc test bookings/availability/invoices/payments.
- Môi trường: Node 24.18.0, npm 11.16.0, MongoDB cài máy 8.2, cổng test 27029.

### Baseline main

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

### Nhánh UC49 sau sửa lỗi

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

### Sửa lỗi đã thực hiện trên nhánh fix

- Assertion tiền VND dùng accessible cell matcher chấp nhận khoảng trắng không ngắt dòng do Intl tạo.
- Test phân trang chờ query hoàn tất trước khi bấm nút, tránh thao tác lúc đang loading.
- Menu thêm vùng chạm tối thiểu 44px.
- Test seed UC49 chỉ gọi seed Amenity/RoomType, không gọi seed toàn hệ thống để tạo User/Booking trước suite H5. Suite seed tổng sẵn có vẫn kiểm tra registry mới và pass trong toàn bộ e2e.

### Phạm vi business rule của use case chỉ đọc

- BR-FAC-02: không tạo Room trong task này; quan hệ mỗi Room thuộc một RoomType phải được triển khai ở #30–31.
- BR-FAC-04: schema và availableForBooking kiểm tra capacity/giá, không thêm field availability lưu DB.
- BR-FAC-05: trả cả loại inactive và không có endpoint xóa.
- BR-FAC-06: response chỉ populate tiện nghi còn tồn tại; service ghi của #29 phải kiểm tra tồn tại/tham chiếu, không coi ref Mongoose là foreign key tự kiểm tra DB.

### Điều kiện còn chặn xuất bản

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

### Task tiếp theo được mở khóa

- #29 UC50: có sẵn RoomType/Amenity schema, module export và UI/API list để thêm tạo/sửa.
- #32–33: có Amenity model và seed tối thiểu.
- H6: mới có phần RoomType; vẫn cần Room/RoomStatus và adapter nguồn phòng thật ở task riêng.
- H4 Service chưa được triển khai; không coi #28 là hoàn thành mọi hợp đồng cơ sở vật chất.

## Cập nhật mới nhất — sửa format và miễn Docker (23/10/2026)

Mục này thay thế các thông tin “còn chặn xuất bản” ở snapshot bàn giao trước.

- Người dùng đã cho phép sửa format cả phần backend kế thừa và **tạm bỏ qua Docker vì máy không cài được Docker**.
- Đã tạo nhánh `fix/28-backend-format`, commit `57e572e`, chỉ format 24 file qua Prettier rồi merge cục bộ về feature.
- Đã đối chiếu AST TypeScript trước/sau: cấu trúc tương đương khi bỏ trivia và ngoặc dư; không sửa logic nghiệp vụ.
- Backend `npm run format:check`, `lint`, `typecheck`, `build`: **pass**.
- Backend unit chạy lại: **151/151 pass**; e2e chạy lại trên DB sạch `hms_task28_format_final`: **43/43 pass**. Tham số một worker thread và timeout giữ như các lệnh ở bảng trên.
- Frontend không đổi trong lần sửa format; kết quả trước đó **31/31 test**, lint/format/typecheck/build pass vẫn áp dụng.
- Docker là **miễn kiểm tra theo yêu cầu người dùng**, không phải đã chạy/pass.
- Không còn blocker kiểm tra cục bộ của UC49 theo phạm vi đã điều chỉnh. Xuất bản tiếp theo quy trình Git được người dùng cho phép: push feature, merge commit vào main và push; máy không có gh CLI nên dùng phương án Git trực tiếp. Trạng thái remote và commit merge xác nhận qua báo cáo cuối/git log.
