# Bàn giao #29 — UC50 Create / Update Room Type

> UC50 đã merge main tại e49794c. Cập nhật 24/10/2026: bản sửa [sức chứa người lớn/trẻ em](SUA-LOI-ROOM-TYPE-CAPACITY.md) đang thay capacity bằng adultCapacity/childCapacity trên nhánh fix/28-room-type-capacity; xem tài liệu mới cho migration, check và blocker. Các hợp đồng capacity bên dưới được giữ làm lịch sử.

Ngày: 23/10/2026. Baseline `main` đã pull tới `4213c8d`; UC49 đã merge qua `4134194`. Nhánh triển khai `feature/29-room-type-form`, commit triển khai `78821b7`; sửa kiểm thử trên `fix/29-form-validation-tests`, commit `99c3d21`, đã tích hợp về feature cục bộ. Chưa có PR/commit merge main cho UC50.

## Đã triển khai

- Kế thừa schema RoomType/Amenity của #28, giữ tên giá `basePrice`, không thêm schema/enum hoặc endpoint DELETE.
- API tạo, đọc chi tiết, cập nhật từng phần và chọn tiện nghi thật từ MongoDB. Quyền MANAGER hoặc `facility:manage`, giống UC49, dùng guard hiện có.
- Form dùng chung tạo/sửa trong native `<dialog>`, giữ nguyên state tìm kiếm, bộ lọc và trang của danh sách. Native dialog giữ focus, hỗ trợ Esc, trả focus về nút mở; chặn đóng khi đang gửi.
- Tên, mô tả, sức chứa, giá VND, tiện nghi và trạng thái; giá hiển thị vi-VN, gửi số nguyên. Tiện nghi đã gắn nhưng inactive hiển thị “ngừng” và có thể bỏ. Có loading/lỗi/thử lại/rỗng cho tiện nghi.
- Lỗi field liên kết aria-describedby, focus lỗi đầu tiên, gắn 409 trùng tên và lỗi tiện nghi vào đúng trường; giữ dữ liệu khi lỗi. Chống double submit, loading/disabled và thông báo thành công sau khi invalidate danh sách/chi tiết.
- Ngừng nhận đặt phòng là hành động riêng, có xác nhận, chỉ gửi PATCH `{ isActive: false }`. Giữ nguyên bản ghi và tham chiếu; không viết hoặc giả lập kiểm tra reservation.

## API / DTO

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

## Hợp đồng bàn giao — mẫu mục 15

- **Task/phạm vi:** #29 UC50, backend/frontend/test; Amenity chỉ có endpoint options và provider validate, chưa phải CRUD #32–33.
- **Provider:** RoomTypesModule tiếp tục export RoomTypesService và MongooseModule. `RoomTypesService.create(CreateRoomTypeDto)`, `detail(id)`, `update(id, UpdateRoomTypeDto)`, `list(query)`. AmenitiesModule export AmenitiesService và MongooseModule; `validateNew(ids, retainedIds?)`, `options()`.
- **Route:** giữ `/manager/room-types`, thêm hộp thoại tại trang đó; không cần route tạo/sửa riêng hoặc thay router/layout chung.
- **Seed/thứ tự:** không đổi `roles → users → amenities → room-types → bookings → feedback`; seed vẫn `$setOnInsert`. Không đổi seed booking hoặc nguồn giá invoice.
- **#31 Room:** import RoomTypesModule khi cần model/service; mỗi Room tham chiếu đúng một RoomType theo task #31. Không dùng `availableForBooking` để suy ra phòng trống theo ngày.
- **H6:** RoomType cung cấp capacity, basePrice/isActive và trạng thái hợp lệ; adapter nguồn phòng thật vẫn thuộc task riêng. Không thay thuật toán booking/availability hoặc nguồn giá lịch sử H7.
- **Giả định:** tên tối đa 100 ký tự; giá VND > 0 và capacity >= 1, chỉ có trần kỹ thuật Number.MAX_SAFE_INTEGER; giữ unique phân biệt hoa thường của schema. Không thêm business rule chặn sửa giá theo booking.
- **Mock/TODO production:** không có mock hoặc TODO chặn UC50; fixture chỉ nằm trong test. Module Task trên baseline chặn chạy ứng dụng Node/seed, xem bên dưới.
- **Task mở khóa:** #31 có service tạo/sửa RoomType, #32–33 có options/validation provider để mở rộng. H3 Room/H6 adapter chưa được triển khai bởi UC50.

## Kiểm tra thực chạy

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

## Blocker và trạng thái xuất bản

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

## Cập nhật xuất bản theo yêu cầu mới

Backend `npm run typecheck` sau khi đồng bộ main: pass. Chưa chạy lại toàn bộ test sau lần đồng bộ này.

Người dùng đã yêu cầu push UC50 dù lỗi seed thuộc module Task, sau đó lấy các phần mới từ main. Đã push `feature/29-room-type-form`, fetch main tới `f9dcb4a` và merge vào feature bằng commit `e5a44c8`, không có conflict. Main mới bổ sung nền tảng VNPay, settlement và payment endpoints; không phải thay đổi UC50. Thông tin “chưa push” phía trên là snapshot trước yêu cầu này. Chưa mở PR hoặc merge UC50 vào main; kết quả unit/e2e phía trên được đo trước lần cập nhật main này.
