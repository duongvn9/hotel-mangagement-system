# H6 / #43 — Availability core và hợp đồng nối H3

## Phạm vi

Base `f968219` (origin/main): H5 PR #12 và H7 PR #13 đã merge. Không có module/schema Room, RoomType hay RoomStatus của H3. H6 không tạo schema thay thế, dữ liệu phòng giả trong production, controller hoặc public endpoint gây hiểu nhầm. Hoàn thành core, service, truy vấn Booking/RoomHold thật và test; UC05 end-to-end còn chờ H3.

## Hợp đồng

`AvailabilityService.findAvailableRooms({ checkIn, checkOut, guests, roomTypeId? }): Promise<AvailableRoom[]>` được export từ BookingsModule. Các kiểu được export trong `availability.core.ts`; datasource và clock nằm trong `availability.adapters.ts`.

- checkIn/checkOut: chuỗi lịch hợp lệ `YYYY-MM-DD` hoặc Date biểu diễn instant. Chuỗi timestamp bị từ chối để tránh parsing mơ hồ; caller chuyển ISO có timezone thành Date trước khi gọi.
- Date instant chuyển sang ngày nghiệp vụ bằng Intl với `Asia/Ho_Chi_Minh`, sau đó lấy 00:00 +07:00, lưu/so sánh Date UTC. Ví dụ 23/10 tương ứng 22/10 17:00Z. Đây là tìm theo đêm, không hỗ trợ thuê theo giờ. Booking/Hold cũng chuẩn hóa cùng quy tắc; không áp dụng raw UTC midnight query gây bỏ sót boundary.
- Khoảng nửa mở `[checkIn, checkOut)`, giao nhau khi `startA < endB && startB < endA`. Ngày trả phòng có thể là ngày nhận phòng tiếp theo.
- Từ chối ngày sai, ngày không tồn tại, checkout <= checkin sau chuẩn hóa, guests không phải số nguyên dương an toàn, roomTypeId không phải ObjectId hex 24 ký tự.
- Kết quả mới chỉ gồm `id`, `roomTypeId`, `capacity`, không có booking/guest/contact/hold/internal Mongo fields.

## Nối H3

Thay provider `AvailabilityRoomSource` trong BookingsModule bằng adapter thật (hoặc import module H3 và dùng useExisting). Mặc định ném ServiceUnavailableException, không trả phòng giả hoặc nuốt lỗi DB. Bootstrap vẫn hợp lệ.

Adapter `findCandidates(query)` nhận query đã chuẩn hóa với Date UTC, guests, roomTypeId tùy chọn; trả danh sách physical rooms:

| Trường | Hợp đồng |
|---|---|
| id / roomTypeId | Chuỗi ObjectId canonical lowercase từ Room/RoomType thật |
| capacity | Sức chứa nguyên dương từ RoomType thật |
| isActive | Room tồn tại và active |
| roomTypeActive | RoomType tham chiếu tồn tại và active; thiếu ref = false |
| operationallyAvailable | Trạng thái cho phép lưu trú trong toàn khoảng yêu cầu |

BR-BOOK-03: AVAILABLE mới được phép; OCCUPIED/CLEANING/MAINTENANCE/unknown không được phép nếu ảnh hưởng khoảng yêu cầu. Khi chỉ có trạng thái hiện tại và chưa có lịch hiệu lực, adapter phải loại các trạng thái này cho mọi khoảng (bảo thủ), không suy đoán tương lai sẽ được dọn xong. Không định nghĩa enum RoomStatus trùng trước H3.

Adapter nên lọc Mongo theo active, capacity, roomTypeId và trạng thái; core vẫn kiểm tra lại các cờ và capacity. Search hiện trả phòng đơn có capacity >= guests. BR-BOOK-01 cho phép tổng sức chứa nhiều phòng khi chọn booking: #46 phải kiểm tra tổng capacity tập phòng đã chọn. H6 không ghép tổ hợp phòng nhỏ thành gói đủ guests; không dùng kết quả này để kết luận một tổ hợp nhiều phòng không hợp lệ.

Khi nối thật: thêm DTO class-validator/Swagger, public safe response và controller `@Public()`, test API/DB phòng thật. Hiện không có API UC05, UI hay mock production.

## Booking và hold

Dùng duy nhất BookingStatus hiện có. CONFIRMED/CHECKED_IN active chặn mọi physical room trong booking nếu overlap; CANCELLED/CHECKED_OUT không chặn. Completed stay không phải reservation đang hoạt động; phòng sau checkout còn CLEANING vẫn bị H3 loại. isActive=false không chặn.

PENDING_DEPOSIT một mình không chặn: H5 không có deadline trên Booking. Hold active với expiresAt > injected now mới là bằng chứng giữ phòng. Đúng thời điểm expiry được giải phóng ngay cả khi document còn tồn tại. Mongo TTL bất đồng bộ chỉ dọn rác, không quyết định availability. Đồng hồ chụp một lần mỗi request và có thể override qua AvailabilityClock.

Hold phải overlap và chứa ID phòng ứng viên. Parent inactive/CANCELLED/CHECKED_OUT làm hold stale không chặn. Parent pending/confirmed/checked-in cho phép hold chặn. Nếu thiếu parent, rooms không khớp parent, interval không khớp hoặc status không nhận biết: giữ bảo thủ các phòng được hold khai báo đến expiry, không tự giải phóng do dữ liệu hỏng. Hold không lan sang phòng chỉ có trong parent pending. Active booking/hold có interval lỗi được coi là conflict bảo thủ. Mất toàn bộ room references không thể suy ra phòng nào; chỉ chặn các ID còn biết, cần kiểm tra/sửa integrity phía writer. Đây là chính sách giải quyết ambiguity của pending/hold, không phải quy tắc expiry mới từ SRS.

Mongo lọc candidate room IDs và active confirmed/checked-in bookings; lấy active unexpired holds, rồi tải tất cả parent theo ID kể cả terminal/inactive/không overlap để không nhầm parent bị lọc thành orphan. Không lọc raw date trong Mongo vì dữ liệu H5 chưa đảm bảo boundary canonical. Core chuẩn hóa và kiểm tra interval. Set room IDs dedup booking/hold/multiple conflicts. Tradeoff: có thể đọc nhiều lịch sử; sau khi chuẩn hóa dữ liệu toàn hệ thống mới tối ưu overlap query/index theo UTC boundary.

## Giới hạn concurrency / #46

Đây là read-only search snapshot, KHÔNG bảo đảm booking thành công. Các query không nằm trong transaction và có thể quan sát cập nhật xen kẽ. #46 phải đọc lại phòng/trạng thái/capacity/booking/hold ngay lúc ghi, dùng cơ chế giữ phòng concurrency-safe (serialization/atomic lock hoặc inventory theo room-night với unique constraint và transaction/retry phù hợp). Unique booking reference của RoomHold không ngăn hai booking giữ cùng phòng. Không dùng search-then-insert không khóa. H6 không triển khai CreateBooking, thanh toán hay Phase4.

## Kiểm thử và gate

Unit thuần không Mongo: 28 case core + 3 service mock, overlap hai chiều, adjacency, trạng thái, multiroom, pending/expiry/TTL tồn tại, missing parent, mismatch, capacity, type, operational flags, invalid dates, Vietnam boundary, dedup/repeated calls và default fail-closed.

Integration `backend/test/availability.e2e-spec.ts`: AppModule/Nest DI thật, Booking/Hold Mongo thật, chỉ override Room datasource và clock; pending/active/expired persisted/inactive holds, cancelled/confirmed, multiroom, adjacency và orphan. Không tạo schema Room giả.

Backend image rebuild Node 24.22.1: lint 0 warning/error, typecheck pass, unit 130/130, build pass, e2e 30/30 trên DB riêng `hms_h6_20261023_1849`. Không chạy test trên DB dev. Warning vite-tsconfig-paths và mongoose `new` là từ code/tooling hiện hữu, không sửa ngoài phạm vi.
