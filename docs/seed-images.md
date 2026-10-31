# Ảnh seed Grand Emily HMS

Ảnh được đọc trực tiếp từ storage đã upload. `hms/` chỉ để đối chứng, không được copy sang frontend hay upload lại. DB lưu đường dẫn tương đối `/images/seeds/...`.

## Phần đã có được giữ lại

- `backend/src/database/seed.ts`: cơ chế chạy seed theo module.
- `backend/src/modules/*/seed.ts`: giữ `$setOnInsert`, khóa tìm kiếm, giá, trạng thái và quan hệ; chỉ bổ sung ảnh cho bản ghi mới.
- `backend/src/modules/room-types/migrate-capacities.ts`: giữ migration sức chứa hiện tại; backfill ảnh dùng cách truy cập collection trực tiếp tương tự để giữ timestamp.
- Các DTO tạo/cập nhật, Swagger, mapper, API client và layout hiện có được mở rộng tại chỗ.
- Không thêm thư viện, chức năng upload hoặc thay đổi đăng nhập/phân quyền.

## File mới

- `backend/src/common/asset-path.ts`: regex dùng chung cho DTO ảnh.
- `backend/src/common/asset-path.spec.ts`: kiểm tra đường dẫn và giới hạn gallery.
- `backend/src/database/seed-assets.ts`: ánh xạ tên seed/assetCode sang object key.
- `backend/src/database/backfill-assets.ts`: điền ảnh thiếu bằng filter nguyên tử, không upsert, chỉ `$set` trường ảnh; báo số khớp/cập nhật/khóa không tìm thấy.
- `backend/src/database/backfill-assets.spec.ts`: kiểm tra điều kiện bảo vệ và phạm vi cập nhật.
- `backend/src/backfill-assets.main.ts`: entry riêng, không khởi tạo các module nghiệp vụ của AppModule.
- `frontend/src/lib/asset-url.ts`: ghép biến môi trường với đường dẫn DB.
- `frontend/src/components/AssetImage.tsx`: fallback chữ viết tắt, ghi nhớ URL lỗi bằng state, gallery theo thứ tự mảng.
- `frontend/src/components/AssetImage.test.tsx`: kiểm tra thiếu ảnh, ảnh lỗi, đổi URL và thứ tự gallery.

## File chỉnh sửa

- `backend/src/modules/{users,room-types,services,amenities,equipment}/schemas/*.schema.ts`: trường ảnh tùy chọn; `images` mặc định `[]`.
- `backend/src/modules/{users,room-types,services,amenities}/dto/*.ts`: DTO ghi và mô tả response liên quan đến ảnh; không tạo API sửa thiết bị mới.
- `backend/src/modules/{users,room-types,services,amenities,equipment}/*.service.ts`: đưa ảnh qua mapper/projection hiện có.
- `backend/src/modules/auth/auth.service.ts`: trả avatar qua `me` và `dev-accounts`.
- `backend/src/modules/service-orders/service-orders.service.ts`: trả ảnh trong catalog dịch vụ dành cho khách.
- `backend/src/modules/{room-types,services,amenities,equipment}/seed.ts`: ảnh cho bản ghi mới, gồm bản ghi inactive.
- `backend/src/modules/bookings/{availability.core,mongo-availability-room-source}.ts`: đưa gallery loại phòng qua API tìm phòng công khai.
- `backend/src/modules/maintenance/{maintenance-history.service.ts,dto/maintenance-history.dto.ts}`: ảnh thiết bị trong lịch sử.
- `backend/package.json`: lệnh `backfill:assets`.
- `backend/src/modules/room-types/room-types.spec.ts`: cập nhật projection được kỳ vọng và xác nhận ảnh/icon đi qua API.
- `frontend/.env.example`, `frontend/src/vite-env.d.ts`: cấu hình origin/bucket public.
- `frontend/src/features/{accounts,auth,room-types,services,amenities,maintenance,booking,service-orders}/api.ts`: trường ảnh trong interface liên quan.
- Các trang danh sách accounts/room-types/services/amenities, `auth/UserMenu.tsx`, trang login/profile, trang tìm phòng/tạo booking, trang tạo yêu cầu dịch vụ, báo hỏng, `maintenance/components/HistoryPresentation.tsx`, `room-types/components/AmenityChips.tsx`: hiển thị ảnh qua component chung.

## Khác với bảng ban đầu

- Theo xác nhận của bạn, dùng `.jpg` đúng theo `hms/`, riêng thang máy là `equipment/lift.jpg`. Icon tiện nghi giữ `.svg`.
- Tên seed trong code khớp bảng ánh xạ. File `tv-102 (2).jpg` không được dùng; chọn `tv-102.jpg`.
- `hms/users` chưa có ảnh: đã hỗ trợ `avatarUrl` ở schema, DTO, API và giao diện; chưa gán avatar seed/backfill khi chưa có object key xác nhận. Tài khoản dùng fallback.
- Backfill ảnh là lệnh riêng; không chạy seed vì seed loại phòng hiện có bước migration sức chứa.

## Bạn tự chạy sau khi kiểm tra cấu hình

1. Đặt `VITE_ASSET_BASE_URL` trong `frontend/.env.local` thành public origin/bucket thực tế, không bao gồm `/images/seeds`. Ví dụ trong `.env.example` chỉ là giá trị mẫu. Khởi động lại Vite hoặc build lại frontend sau khi đổi biến.
2. Kiểm tra `MONGODB_URI` trong môi trường backend trỏ đúng database.
3. Từ thư mục `backend`, chạy `npm run backfill:assets` để bổ sung ảnh vào seed đã tồn tại. Không cần chạy seed chỉ để cập nhật ảnh.
4. Kiểm tra bảng kết quả và mở URL ảnh thực tế, gồm Suite/spa/thiết bị inactive; xác nhận bucket public đọc được.
5. Khi có avatar trên storage, bổ sung object key đã xác nhận vào seed/backfill người dùng.

Không có lệnh ghi MongoDB nào được chạy trong quá trình triển khai này. Cần kiểm tra ảnh trên trình duyệt với storage thực tế sau khi bạn cấu hình và chạy backfill.

## Kết quả kiểm tra

- Backend và frontend: `npm run build`, `npm run lint` thành công. Backend typecheck cuối cùng cũng thành công. Frontend build cảnh báo bundle lớn hơn 500 kB.
- Backend: 50 file, 979 test pass khi chạy với `--pool=threads --maxWorkers=1 --testTimeout=60000 --hookTimeout=60000`. Sau lần siết filter cuối, chạy lại riêng validation/backfill: 3/3 pass.
- Frontend: lượt đầy đủ có 668/670 test pass; hai lỗi ở suite loại phòng dùng component ảnh được nạp trước bản sửa accessibility. Đã sửa ảnh cạnh tên thành ảnh trang trí để tránh lặp accessible name. Chạy lại toàn bộ hai suite `RoomTypeForm.test.tsx`, `RoomTypesPage.test.tsx`: 30/30 pass; component ảnh mới: 3/3 pass. Không chạy lại toàn bộ frontend sau bản sửa cuối.
- Đối chiếu 27/27 đường dẫn mapping đều có file trong `hms`; `git diff --check` thành công.
