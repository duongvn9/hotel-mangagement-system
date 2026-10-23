# Tiến độ Trần Bảo Lâm — Grand Emily HMS

Cập nhật 24/10/2026. Đây là tài liệu tiến độ và bàn giao duy nhất của Lâm; các task sau tiếp tục cập nhật vào file này. File CLAUDE-CONTEXT-TRAN-BAO-LAM.md giữ vai trò context dự án, không phải một file tiến độ theo UC.

## Hiện trạng mới nhất

| Phần việc | Trạng thái / revision |
|---|---|
| #28 UC49 | Đã merge main: 4134194 |
| #29 UC50 | Đã merge main: e49794c |
| Tách sức chứa adultCapacity/childCapacity | Đã merge main: cfb2394 |
| Sửa import Connection của Task | Đã merge main: 7684a45; seed toàn ứng dụng pass hai lần |
| #30 UC47 View Room List + H3 Room/RoomStatus | Đang triển khai trên feature/30-room-list từ main 7684a45 |

Hợp đồng RoomType hiện hành dùng adultCapacity và childCapacity, không dùng capacity. H6 vẫn giữ hợp đồng capacity/guests riêng; chưa nối adapter Room thật. Các mục lịch sử bên dưới ghi lại đúng trạng thái từng thời điểm, kể cả blocker đã được xử lý; không dùng snapshot cũ để kết luận trạng thái hiện tại.

## Quy trình Git thường trực

- Làm xong nhánh feature hoặc fix nào thì push và merge nhánh đó vào main bằng merge commit khi đủ scope và các kiểm tra đã pass hoặc được người dùng miễn rõ ràng; không dừng ở push.
- Sau merge, pull main mới nhất trước khi tạo nhánh tiếp theo. Fix tách từ feature phải giữ thứ tự phụ thuộc khi tích hợp vào main.
- Không force-push, không sửa Jira/nhánh người khác; commit Conventional Commits. Docker được miễn theo yêu cầu trước của người dùng, không báo là đã chạy/pass.

<a id="uc47"></a>
## #30 — UC47 View Room List và hợp đồng H3

Phạm vi: GET /api/v1/rooms, schema Room/RoomStatus, seed, trang /manager/rooms và kiểm thử. Chỉ đọc; không có nút hoặc API tạo/sửa/ngừng phòng (thuộc #31). Chi tiết và kết quả kiểm tra được cập nhật trong mục này trước khi xuất bản.

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
