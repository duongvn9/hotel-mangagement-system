# Sửa sức chứa RoomType — #28 / #29

Ngày 24/10/2026. Nhánh `fix/28-room-type-capacity`, từ main `e49794c` sau khi pull; đã xác nhận UC49 (`4134194`) và UC50 (`e49794c`) có trong lịch sử main. Đây là sửa lệch ERD theo yêu cầu người dùng, không phải mở rộng H6 hoặc Booking.

## Hợp đồng mới

- RoomType thay `capacity` bằng **adultCapacity** (số nguyên an toàn >= 1) và **childCapacity** (số nguyên an toàn >= 0). Cả hai bắt buộc khi tạo; PATCH vẫn từng phần. ChildCapacity = 0 hợp lệ.
- Các giới hạn >= 1 / >= 0 là **giả định được yêu cầu trong prompt**, chưa phải business rule được nhóm duyệt; SRS chỉ nói “valid capacity”. Không thêm trần nghiệp vụ ngoài giới hạn số nguyên an toàn của JavaScript.
- GET list/detail, POST/PATCH response và Swagger dùng hai field mới, không trả field tổng hoặc `capacity`. POST/PATCH gửi field cũ trả 400 qua forbidNonWhitelisted.
- Sort chấp nhận `name | basePrice | adultCapacity | childCapacity`, vẫn thêm `_id asc` để phân trang ổn định; `sortBy=capacity` trả 400.
- `availableForBooking = isActive === true && validAdultCapacity(adultCapacity) && validChildCapacity(childCapacity) && validBasePrice(basePrice)`. Tạo active, kích hoạt lại và sửa dữ liệu active đều kiểm tra trạng thái sau cập nhật. Không lưu giá trị dẫn xuất.
- Atomic PATCH đối chiếu snapshot cả hai field mới cùng basePrice/isActive/amenities; `$set` chỉ chứa field đã gửi, bật runValidators và trả dữ liệu sau ghi.
- Giá, tên unique phân biệt hoa thường, xử lý E11000/409, tiện nghi active/retained, soft deactivate, quyền Manager hoặc facility:manage và việc không có DELETE được giữ nguyên.

Frontend thay cột sức chứa thành **Người lớn** và **Trẻ em**, căn phải; bảng vẫn cuộn ngang trong container ở mobile. Form dùng hai ô number có min/step, validation client riêng, aria-describedby và focus lỗi. Lỗi backend chứa adultCapacity/childCapacity được gắn vào đúng ô. Không đổi modal, xác nhận ngừng, filter, phân trang, thông báo/invalidation hoặc xử lý tiện nghi.

## Migration và seed

`backend/src/modules/room-types/migrate-capacities.ts` export `migrateRoomTypeCapacities(model)`, được gọi đầu `seedRoomTypes`, trước seed mẫu.

Native MongoDB collection update pipeline chỉ khớp document có `capacity` và **chưa có cả adultCapacity lẫn childCapacity**:

1. Gán adultCapacity bằng nguyên giá trị capacity cũ, childCapacity = 0.
2. Gỡ capacity trong cùng atomic update của document.

Không đổi `_id`, timestamps, tên, mô tả, giá, trạng thái hoặc tiện nghi; không ghi đè dữ liệu đã có field mới. Chạy lại không đổi bản ghi đã chuyển. Dùng collection trực tiếp để đọc field legacy đã bị gỡ khỏi Mongoose schema và tránh cập nhật timestamp khi chỉ chuyển cấu trúc.

Document đã có một field mới nhưng thiếu field còn lại được giữ nguyên để tránh ghi đè dữ liệu chuyển dở; cần kiểm tra/chỉnh rõ ràng nếu gặp. Dữ liệu legacy có capacity không hợp lệ được giữ nguyên giá trị khi chuyển; không tự đoán hoặc sửa số, và availableForBooking sẽ false cho tới khi hợp lệ. Chạy migration trước khi sử dụng hợp đồng API mới với dữ liệu legacy.

Mẫu **mới được insert**: Standard 2/1, Deluxe 2/0, Suite 4/2 (người lớn/trẻ em). Seed mẫu vẫn `$setOnInsert`, không ép dữ liệu Standard/Deluxe/Suite đã chỉnh theo giá trị mẫu. Bản ghi Standard legacy capacity=2 chuyển thành 2/0, không bị seed đổi thành 2/1.

## Kiểm tra thực chạy

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

## Phần H6 còn dùng capacity — bàn giao Hiếu

Không sửa `AvailabilityRoomSource` hoặc ánh xạ adult/child sang guests. Production còn `capacity` tại:

- `backend/src/modules/bookings/availability.core.ts:18`: field capacity của candidate/available room.
- `backend/src/modules/bookings/availability.core.ts:133`: kiểm tra số nguyên an toàn.
- `backend/src/modules/bookings/availability.core.ts:134`: so sánh capacity với query.guests.
- `backend/src/modules/bookings/availability.core.ts:139`: trả projection id/roomTypeId/capacity.

Fixture/assertion H6 còn dùng capacity trong `availability.core.spec.ts`, `availability.service.spec.ts` và `backend/test/availability.e2e-spec.ts`. Tài liệu `docs/H6-AVAILABILITY.md`, các snapshot context và `docs/TIEN-DO-HIEU.md` cũng còn mô tả hợp đồng H6 cũ. Không tự sửa các phần thuộc Hiếu.

Grep toàn repository xác nhận room-types/amenities không dùng capacity trong hợp đồng hiện hành; các chỗ còn lại của room-types là migration hoặc test từ chối field cũ/fixture legacy. Tài liệu UC49/UC50 cũ được giữ làm lịch sử và có link tới hợp đồng mới này.

## Cập nhật context theo mẫu mục 15

- **Ngày/revision:** 24/10/2026, baseline main e49794c; branch fix/28-room-type-capacity. Chưa có PR/merge main cho bản sửa này.
- **Phạm vi:** schema/DTO/service/seed/API/types/table/form/test RoomType; không đổi Room, Booking/H6, Amenity/Service, layout hoặc thanh toán.
- **Provider/API:** giữ RoomTypesModule và RoomTypesService create/detail/update/list; payload/response dùng adultCapacity/childCapacity. Amenities options/validation giữ nguyên.
- **Module khác dùng:** đọc hai field riêng; ánh xạ sang H6 do Hiếu quyết định, không tự cộng thành tổng trong response hoặc sửa hợp đồng H6.
- **Seed:** thứ tự registry không đổi; migration chạy đầu seedRoomTypes, mẫu mới dùng hai field, dữ liệu đã sửa không ghi đè.
- **Checks:** bảng kết quả thực chạy ở trên; phân biệt seed module pass với seed ứng dụng fail.
- **Giới hạn:** npm run seed bị lỗi runtime Task có sẵn; Docker CLI không có. Không sửa việc ngoài scope và không đánh dấu các check đó pass.
- **Task tiếp theo:** Room #30–31 phải dùng hai field sức chứa mới; H6 adapter vẫn cần thống nhất riêng. Đây không phải triển khai H6/Booking AdultCount/ChildCount.

## Trạng thái xuất bản

`npm run seed` cả hai lần báo:

```text
backend/src/modules/tasks/tasks.service.ts:10
import { Connection, Model, Types } from 'mongoose';
SyntaxError: The requested module 'mongoose' does not provide an export named 'Connection'
```

Module Task không có diff so với main; lỗi này đã được tái hiện trên main sạch ở lần bàn giao UC50 trước. Chưa push/mở PR/merge bản sửa sức chứa, vì prompt mới yêu cầu không xuất bản khi check bắt buộc còn đỏ/chưa chạy. Quyết định miễn blocker khi merge UC50 trước đó không tự được coi là miễn cho task sửa sức chứa mới.

Sau khi xử lý hoặc có miễn kiểm tra rõ ràng cho blocker: cập nhật main, chạy lại check cần thiết rồi push/PR/merge commit theo quy trình. Tiêu đề PR đã yêu cầu: `fix(room-types): split capacity into adult/child (#28, #29)`.
