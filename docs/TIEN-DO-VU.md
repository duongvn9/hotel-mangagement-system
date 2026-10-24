# Tiến độ phần việc của Vũ

## Đọc nhanh

- H8: **MERGED**, PR #15 tại `c970bf4`; đã kiểm tra local commit này là ancestor của `origin/main`.
- #64: **MERGED**, PR #16 tại merge commit `4046fe0`; đã kiểm tra local commit này là ancestor của `origin/main`. Merge không đồng nghĩa đã xác nhận integration contract nguồn thật.
- PR #16: https://github.com/duongvn9/hotel-mangagement-system/pull/16 — đã merge; các giả định mapping collection và tích hợp nguồn vẫn chưa được giải quyết.
- #66 / PROMPT03 / UC37: **MERGED**, PR #17 tại merge commit `53401ad`; đã xác minh merge. https://github.com/duongvn9/hotel-mangagement-system/pull/17
- #67 / UC38: **MERGED**, PR #18 tại merge commit `341f87f`; đã xác minh commit là ancestor của local `origin/main` khi triển khai #65. Commit triển khai `3712665`; các bằng chứng pending trong mục 10 được giữ như lịch sử trước merge.
- #65: **MERGED**, PR #19 tại merge commit `4213c8d`. Mục 11 giữ lịch sử triển khai trước merge, không còn là trạng thái pending hiện tại.
- #74 / UC28: **MERGED**, PR #20 tại merge commit `266e40b`; parent đã xác minh merge. https://github.com/duongvn9/hotel-mangagement-system/pull/20 — mục 12 giữ bằng chứng triển khai trước merge, không phải trạng thái pending hiện tại.
- #75 / UC29 và #79 / UC33: **Implemented, pending review, không Done** trên nhánh hiện tại `feature/vu-75-79-issue-list-detail`; chưa ghi commit/PR, parent bổ sung sau. Xem mục 13.
- Task core có persistence, atomic active-work uniqueness và CAS; UC37 GET giữ nguyên, UC38 đã có PATCH tiến độ và form detail. Mục 13 là hiện trạng Issue list/detail; mục 12 lưu lịch sử UC28; mục 11 lưu lịch sử #65; mục 10 lưu bằng chứng #67 trước merge; mục 9 lưu lịch sử UC37 trước merge; mục 8 lưu mốc #64 trước merge; mục 4–7 là lịch sử.
- Đã đọc UC37/38, BR-TASK-03/05 và ERD ngoài repo trong thư mục `WDP301/docs`.
- **Không đổi contract H8 nếu chưa thông báo nhóm**, đặc biệt Lâm dùng cho UC35/UC55 và các nguồn Service Order/Issue/Maintenance.

## 13. Jira #75 / UC29 và #79 / UC33 — Issue List / Detail (hiện trạng)

### Trạng thái, SRS và cách chia PR

- **Implemented, pending review, không Done** trên `feature/vu-75-79-issue-list-detail`. Chưa ghi SHA/PR cho #75/#79; parent bổ sung sau, không dùng PR #20 của #74 làm PR cho lượt này.
- Đã đọc SRS ngoài repo `D:/FULearning/Fall26/WDP301/docs/SRS - HMS.docx.md:766–775` (UC29: Customer theo stay/service của mình, Receptionist xem Issue Requests, Manager theo management scope) và `:826–835` (UC33: Manager xem detail đúng scope, không sửa dữ liệu). Detail Customer/Receptionist phục vụ điều hướng list trong cùng quyền đọc; không diễn giải UC33 thành quyền sửa hoặc quyền đọc nguồn mở rộng.
- Ưu tiên PR nhỏ; nếu diff lớn, parent tách **hai commit BE rồi FE trong cùng một PR**, mô tả rõ FE phụ thuộc contract GET của BE và cả hai dựa trên #74 đã merge. Đây là kế hoạch bàn giao, chưa tuyên bố đã commit/tạo PR; lượt này chỉ sửa tài liệu, không thao tác Git.

### API, scope và privacy đã đối chiếu source

- `GET /api/v1/issues` (shared client: `GET /issues`) nhận `page` mặc định 1, giới hạn 1–10000; `limit` mặc định 20, giới hạn 1–100; filter `status`, `priority` theo enum hiện hữu (**PENDING_REVIEW**, **NORMAL**), `category` khớp chính xác, `keyword` tìm literal trên title không phân biệt hoa thường, escape regex. Category/keyword trim 1–100 ký tự; query lạ bị 400. Sort `reportedAt DESC, _id DESC`; response `{ items, total, page, limit }`, items và total cùng filter/scope.
- `GET /api/v1/issues/:id` (shared client: `GET /issues/:id`) trả detail trong cùng scope. ID sai/missing/foreign/out-of-scope cùng 404; anonymous 401, role không được phép 403. Guards xác thực/role và `IssuesService.assertReader` đều kiểm tra; không chỉ dựa vào FE hoặc decorator.
- Customer: đọc các Issue liên kết tới Booking **hiện thuộc `booking.customer` của current user và `isActive === true`**, không dùng reporter, email hay phone. Booking đổi chủ/mất owner/inactive/missing không còn trong scope. Read không thêm điều kiện status khác Cancelled như create UC28; không nhầm policy tạo báo cáo với policy đọc. Đây là snapshot ownership khi đọc Booking rồi query Issue, không hứa transaction/atomic snapshot xuyên collection.
- Receptionist và Manager: chỉ đúng role **RECEPTIONIST / MANAGER**, scope toàn khách sạn đơn hiện tại; service trả scope `{}` cho hai role này. Không có `hotelId` trong model/scope để giả lập multi-hotel; không thêm field hoặc custom permission fallback. Customer, service/operations staff, admin hay custom role không được nâng quyền chỉ vì có permission.
- Projection/DTO allowlist: `id`, `title`, `category`, `description`, `priority`, `status`, `reportedAt` ISO, `bookingId`, `roomId?`, `closedAt?`. Chỉ trả ID nguồn để trace, không populate Booking/Room, reporter/contact/email/phone hay guest PII từ nguồn; ID không phải quyền mở nguồn và không tạo link nguồn chưa được ủy quyền.
- Detail giữ `linkedTasks: []`, **`linkedTasksAvailable: false`**: mở rộng Task deferred do chưa có contract quyền đọc nguồn/task. Không query Task hoặc kết luận “không có task”; FE nói rõ chưa cung cấp thông tin không đồng nghĩa Issue chưa có công việc. Task core/status hiện hữu giữ nguyên, không tạo lại enum/lifecycle Task.
- Chỉ bổ sung read UC29/UC33: **không review, assign, close** (UC30/31/32 còn deferred), không sửa Issue khi đọc, không tự tạo/đóng Task. `POST /api/v1/issues` của #74 và route report giữ nguyên contract.

### Routes, titles và UX thực tế

| Role chính xác | List | Detail | Title hiện tại |
|---|---|---|---|
| CUSTOMER | `/customer/issues` | `/customer/issues/:id` | Sự cố của tôi |
| RECEPTIONIST | `/staff/issues` | `/staff/issues/:id` | Yêu cầu sự cố |
| MANAGER | `/manager/issues` | `/manager/issues/:id` | Danh sách sự cố |

- `RequireAuth` chỉ nhận đúng một role cho từng view; detail title là `<title theo role> — Chi tiết sự cố`, back link về đúng list. `/customer/issues/report` vẫn CUSTOMER; CTA báo mới chỉ cho Customer. Không mở rộng quyền `/staff/tasks` hoặc thay H10/shell; các caveat H10 trong lịch sử vẫn giữ nguyên.
- API thật qua shared client/TanStack Query, cache key gồm current user ID và role; report thành công invalidate scope Issue của user/role. Có filter/reset page, pagination, loading/empty/error/retry, 403/404; detail hiển thị trace ID và cảnh báo linked Task unavailable. Không có nút review/assign/close hoặc mock production.

### Kiểm chứng và giới hạn bằng chứng

Kết quả sau do **parent đã chạy cho triển khai #75/#79**, không phải chạy lại tests/build trong lượt tài liệu; không thay thế CI hoặc manual browser QA. Lượt chỉ sửa tài liệu đã chạy lại `npm run lint` và `npm run typecheck` tại cả backend/frontend: tất cả PASS; không chạy lại format/tests/build/e2e hoặc seed.

| Phạm vi | Lệnh parent đã chạy | Kết quả |
|---|---|---|
| Backend | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build` | Tất cả PASS |
| Backend | `npm test` | PASS: 603 tests / 26 files |
| Frontend | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build` | Tất cả PASS; bundle/chunk-size warning không chặn build |
| Frontend | `npm test` | PASS: 186 tests / 16 files |
| Mongo e2e mở rộng | `backend/test/issues.e2e-spec.ts` | Chưa chạy local: DB test an toàn chưa xác minh; CI pending |

- Fixture e2e mới kiểm tra read scope/ownership đổi chủ, inactive/missing Booking, foreign 404, query/auth/role; cleanup chỉ theo ID Issue/Booking/Room của suite, không drop DB hoặc xóa toàn collection. Có fixture scoped không chứng minh DB đang an toàn; không chạy e2e/seed lên shared DB.
- **Chưa manual browser QA**, chưa xác nhận viewport **375px**, keyboard/overflow hoặc live authenticated API; CI head mới pending. Unit/isolated HTTP/FE tests không thay thế Mongo e2e và không chứng minh source integration hoàn chỉnh. #75/#79 chưa Done.
- Manual QA còn phải chạy: hai Customer A/B với Booking own/foreign, list/total/detail không lộ chéo và foreign URL 404; đổi owner/inactive không còn đọc được; filter status/priority/category/keyword literal, paging/reset và query lạ; anonymous 401, role/custom permission không hợp lệ 403; Receptionist/Manager đúng scope khách sạn đơn, không vượt route role; trace ID không lộ guest PII, Task unavailable không nói không có Task; POST report regression; desktop/375px, keyboard/loading/empty/network/403/404. Ghi bằng chứng thực tế trước khi chốt.

### Source tham chiếu

- BE guards/routes: `backend/src/modules/issues/issues.controller.ts:16`; query: `backend/src/modules/issues/dto/list-issues.dto.ts:19`; service role/scope: `backend/src/modules/issues/issues.service.ts:67`; list/detail/projection: `:90–153`.
- BE tests: `backend/src/modules/issues/issues.service.spec.ts`, `backend/src/modules/issues/issues.http.spec.ts`; Mongo fixture chưa chạy local: `backend/test/issues.e2e-spec.ts:183`.
- FE route/title: `frontend/src/features/issues/routes.tsx:17`, `frontend/src/features/issues/presentation.ts:1`; cache: `frontend/src/features/issues/hooks.ts:5`; UI: `frontend/src/features/issues/pages/IssueListPage.tsx:11`, `frontend/src/features/issues/pages/IssueDetailPage.tsx:6`; tests: `frontend/src/features/issues/issue-read.test.tsx`.

## 12. Jira #74 / UC28 — Report Issue (lịch sử trước merge)

> #74 đã MERGED qua PR #20 tại `266e40b`, parent đã xác minh merge. Các phát biểu pending/chưa có PR/chưa merge và kết quả QA bên dưới giữ nguyên mốc triển khai trước merge, không phải trạng thái hiện tại. Hiện trạng #75/#79 ở mục 13.

### Phạm vi, SRS và giả định eligibility

- **Implemented, pending review, không Done** trên nhánh lúc bắt đầu `feature/vu-74-report-issue`. Chưa ghi SHA/PR cho #74; parent bổ sung sau. Lượt này chỉ cập nhật tài liệu, không sửa module khác.
- Đối chiếu SRS ngoài repo `D:/FULearning/Fall26/WDP301/docs/SRS - HMS.docx.md:755–760` (UC28: context liên quan Customer, đủ thông tin, ghi nhận để review trước giao task) và `:1349–1352` (BR-ISS-01–04, gồm scope đọc cho UC sau). SRS không quy định chỉ được báo khi CHECKED_IN.
- `IssueContextAdapter` typed thật, inject `Model<Booking>` và `Model<Room>`, không dùng stub hay suy ra sở hữu từ email/phone. Booking phải tồn tại, `booking.customer?.equals(currentUserId)`, `isActive === true` và status khác `Cancelled`; currentUserId lấy từ user đã xác thực.
- **Giả định eligibility bảo thủ cần reviewer xác nhận:** booking active, chưa Cancelled là context liên quan hợp lệ; các status còn lại được phép, không áp đặt CHECKED_IN-only hoặc tự suy diễn mốc thời gian lưu trú. Đây là cách triển khai điều kiện “relevant stay”, không phải quy tắc status đã được SRS chốt.
- Booking bắt buộc, room tùy chọn. Nếu có room: ID phải thuộc `booking.rooms`, room phải tồn tại và active. Booking foreign/missing/inactive/cancelled hoặc room không hợp lệ trả 404, không fallback theo thông tin liên hệ.
- Context Service Order **chưa hỗ trợ**: `serviceOrderId` là field không được nhận, API trả 400; không âm thầm bỏ context để tạo báo cáo khác. Không mở rộng Service Order/Booking/Room public API trong #74.

### Contract backend và tích hợp nguồn

- `POST /api/v1/issues` (shared client gọi `POST /issues`), chỉ CUSTOMER. Payload allowlist: `{ title, category, description, bookingId, roomId? }`; trim title/category/description với giới hạn lần lượt 1–200, 1–100, 1–5000 ký tự; bookingId và roomId nếu có phải MongoId, roomId null không hợp lệ. Field lạ hoặc client override reporter/status/priority/time bị 400.
- Server đặt reporter từ `@CurrentUser().id`, `reportedAt` từ giờ server, status ban đầu **PENDING_REVIEW**, priority **NORMAL**. Không nhận reporter/time/status/priority từ client, không tự review hay tạo Task.
- Response DTO an toàn chỉ gồm `id`, `title`, `category`, `description`, `priority`, `status`, `reportedAt`, `bookingId`, `roomId?`; không trả raw document, reporter, contact hoặc populate Booking/Room.
- Schema Issue tối thiểu: nội dung, reporter, booking, room tùy chọn, priority/status, reportedAt, closedAt tùy chọn và timestamps; **chưa có review metadata**, assignment hay workflow UC30/31/32. `IssueStatus` hiện chỉ có PENDING_REVIEW, độc lập `TaskStatus`; không dùng enum lifecycle Task cho Issue.
- Collection thật `issues` đã khớp mapping ISSUE → `issues` hiện có trong Tasks. Điều này giải quyết tên collection cho Issue, **không** chứng minh tích hợp nghiệp vụ nguồn hoàn chỉnh: review eligibility, quyền đọc/soft-delete, source summary/export và giao task còn là dependency UC sau. Không đổi Task core/lifecycle hoặc module khác để giả hoàn tất integration.
- **Seed deferred:** chỉ tạo khi có Booking/Room/User context thật hợp lệ và môi trường được phép; không dùng ID bịa, không dùng e2e fixture làm seed, không chạy seed hoặc gây ô nhiễm DB dùng chung.

### Frontend và giới hạn UX

- Route `/customer/issues/report` và menu chỉ CUSTOMER, RequireAuth đúng role; form gọi API thật qua shared client, mutation không tự retry. Có validation, pending/ref guard chống double submit, receipt từ response server, lỗi 400/401/403/404/network; lỗi mạng nhắc xác nhận trước khi gửi lại.
- Query `bookingId`/`roomId` chỉ prefill **không tin cậy**, vẫn editable và được server xác minh khi submit; query `serviceOrderId` chặn submit và giải thích chưa hỗ trợ. FE chỉ gửi payload allowlist, không gửi actor hoặc trường server-owned.
- **Giới hạn hiện tại:** nhập ID booking/room thủ công, không phải số phòng; chưa có own-booking selector/public API để chọn booking của chính mình. Booking selector và route/API/hook export để tích hợp context từ module khác vẫn là dependency cần thống nhất, không sửa module khác trong lượt tài liệu này hoặc tuyên bố đã có selector.

### Kiểm chứng và giới hạn bằng chứng

Kết quả dưới đây do **parent đã chạy khi triển khai #74**, không phải chạy lại toàn bộ trong lượt sửa tài liệu và không thay thế CI/manual browser QA. Lượt chỉ sửa tài liệu đã chạy lại `npm run lint` và `npm run typecheck` tại cả backend/frontend: PASS; không chạy lại format/tests/build/e2e hoặc seed.

| Phạm vi | Lệnh parent đã chạy | Kết quả |
|---|---|---|
| Backend | `npm run format:check`, `npm run lint`, `npm run typecheck` | PASS |
| Backend | `npm test` | PASS: 544 tests / 24 files |
| Backend | `npm run build` | PASS |
| Frontend | `npm run format:check`, `npm run lint`, `npm run typecheck` | PASS |
| Frontend | `npm test` | PASS: 154 tests / 14 files |
| Frontend | `npm run build` | PASS; chunk-size warning không chặn build |
| Mongo e2e mới | `backend/test/issues.e2e-spec.ts` | **Chưa chạy local**: isolated DB an toàn chưa xác minh; CI pending |

- Unit/isolated HTTP/FE tests không thay thế Mongo e2e hoặc tích hợp nguồn thật. Không chạy e2e/seed trên shared DB; chỉ chạy khi đã xác minh DB test cô lập và cleanup an toàn.
- **Chưa manual browser QA**, chưa có bằng chứng viewport 375px thực tế, keyboard/overflow hoặc live authenticated API. Không suy ra PASS browser từ component tests; CI head #74 còn pending, chưa Done.
- Reviewer/parent cần xác nhận giả định eligibility, QA hai Customer với context own/foreign và room không thuộc booking, payload injection/Service Order rejection, receipt/pending/error và browser desktop/mobile; hoàn tất e2e/CI an toàn trước khi chốt trạng thái.

### Tham chiếu source đã đối chiếu

- Context thật: `backend/src/modules/issues/issue-context.adapter.ts:14`; validation: `backend/src/modules/issues/dto/create-issue.dto.ts:7`; role/actor: `backend/src/modules/issues/issues.controller.ts:15`.
- Server-owned fields/DTO: `backend/src/modules/issues/issues.service.ts:27`; schema/collection/enum: `backend/src/modules/issues/schemas/issue.schema.ts:4`; mapping Task: `backend/src/modules/tasks/tasks.service.ts:28`.
- FE payload: `frontend/src/features/issues/api.ts:40`; route: `frontend/src/features/issues/routes.tsx:5`; prefill và giới hạn context: `frontend/src/features/issues/pages/ReportIssuePage.tsx:29`.

## 11. Jira #65 — Service Staff & Operations Staff dashboards (lịch sử trước merge)

> #65 đã MERGED qua PR #19 tại `4213c8d`. Các phát biểu pending/chưa commit/PR và bằng chứng QA bên dưới giữ nguyên mốc triển khai trước merge, không phải trạng thái hiện tại. Hiện trạng #74 ở mục 12.

### Baseline và phạm vi

- Nhánh `feature/vu-65-staff-dashboards`, working tree sạch trước triển khai; HEAD và local `origin/main` cùng `341f87fe607c312ba89e9b3f6276ffcc80b088f1`. Đã kiểm tra ancestor `c970bf4` (H8/PR #15), `4046fe0` (#64/PR #16), `53401ad` (#66/PR #17), `341f87f` (#67/PR #18). Không fetch trong lượt này; đây là xác minh refs local, không phải xác nhận remote mới nhất.
- Đã đọc SRS ngoài repo `SRS - HMS.docx.md` mục 1.5.2, `screenflow.drawio.png`, DESIGN, role constants, route/menu/layout, Task API/hooks và giới hạn query BE. Không đọc secrets/env; không thay BE, dependency hoặc lockfile. Không commit/push.
- #65 **Implemented, pending review, không Done**. Chưa có commit/PR mới; parent bổ sung sau review.
- H10 chưa có shell theo role trong baseline: router vẫn dùng `PublicLayout` và menu tạm `ROLE_LINKS`. Feature export routes/API/hook độc lập, chỉ tích hợp router/menu tối thiểu, không ghi đè shell. `TODO(#18)` tại chỗ mount dashboard dành cho tích hợp H10 tương lai; số TODO là nhãn được yêu cầu, không khẳng định PR #18 triển khai H10.

### Routes và quyền

- `/staff/service/dashboard`: chỉ `SERVICE_STAFF`; `/staff/operations/dashboard`: chỉ `OPERATIONS_STAFF`, dùng `RequireAuth` với đúng một role, không permission fallback. Customer, Manager, Receptionist, custom role kể cả có `task:execute` và role staff còn lại không vào dashboard chéo. Không triển khai Manager dashboard.
- Hai page export riêng, nội dung dịch vụ/vận hành riêng; menu chỉ hiện dashboard của role hiện tại. `/staff/tasks` và `/staff/tasks/:id` giữ nguyên quyền role OR task permission hiện hữu.
- CTA “Xem công việc được giao” tới `/staff/tasks`, hồ sơ tới `/profile`, task tới detail hiện hữu. Đã đối chiếu route objects thực sự mount qua router: Service History, Report Service Issue, Equipment Fault/Damage, Maintenance History chưa có route; bỏ link hoàn toàn, không tạo link giả hoặc nút disabled. Khi module nguồn merge cần kiểm tra signature/guard/context trước khi bổ sung, đặc biệt Report Service Issue cần task context.

### API đọc và định nghĩa số liệu

- API thật qua shared Axios, không mock production: ba `GET /tasks/me?status=ASSIGNED|IN_PROGRESS|COMPLETED&page=1&limit=1` lấy `total` độc lập. Base URL hiện hữu quyết định prefix `/api/v1`; không gửi userId/assignedTo/actor từ client, server `CurrentUser` scope OWN.
- Active = ASSIGNED + IN_PROGRESS. Đọc từng status với `limit=100`, page từ 1 tới `ceil(total/100)`; không dùng một trang làm toàn bộ tổng. Có AbortSignal TanStack Query → Axios, kiểm tra abort giữa trang, hủy khi unmount/đổi user. Query key `['assigned-tasks', me.id, 'dashboard', me.role]`, không giữ previous user data; tương thích invalidation prefix OWN của UC38.
- Bound vận hành bảo thủ: tối đa **100 trang / 10.000 active task mỗi status**, nhỏ hơn page cap API 10.000; không giả định đây là số lượng staff tối đa. Nếu vượt cap, sai page/limit/total, total đổi, thiếu items, trùng ID hoặc status sai: báo lỗi cụ thể, không render metrics/priority một phần; có thử lại. Không tự retry lỗi consistency/4xx; network/5xx retry tối đa hai lần, có refresh thủ công.
- Đã giao/Đang thực hiện/Hoàn thành = server totals từng trạng thái; Hoàn thành là mọi thời điểm, không phải hôm nay. Near due = active có dueAt hợp lệ trong `[readAt, readAt + 24 giờ]`; overdue = active có dueAt `< readAt`. Không gồm completed hoặc thiếu/invalid dueAt. `readAt` là client clock khi đọc xong, không phải giờ server; hiển thị thời điểm và định nghĩa cạnh cards.
- Priority list: tính trên **toàn bộ** active đã đọc rồi lấy 5; dueAt tăng dần (không hạn sau), cùng hạn theo thứ tự chuỗi đã biết `URGENT > HIGH > MEDIUM/NORMAL > LOW`, chuỗi chưa biết sau rồi so sánh chuỗi và ID để deterministic. Đây chỉ là presentation ranking, không bổ sung enum nghiệp vụ; unknown priority vẫn hiển thị nguyên văn với badge fallback.
- **Snapshot limitation:** các requests không atomic; phát hiện count drift/duplicate/missing nhưng không phát hiện mọi chuyển đổi hoặc reassignment bù trừ giữ nguyên total. Total các status cũng có thể thuộc các thời điểm khác nhau. Không tuyên bố ảnh chụp transaction; trang có caveat và refresh, cần làm mới khi task thay đổi. Không sửa API BE để hứa snapshot không tồn tại.

### UI, kiểm thử và bằng chứng QA

- Token Tailwind/design hiện hữu, cards một cột mobile → nhiều cột desktop, wrap nav/badges, long title, status/priority bằng chữ chứ không chỉ màu, focus-visible cho links, loading `role=status`, lỗi `role=alert`, empty state; không hardcoded hex hoặc thư viện mới.
- 25 tests mới chạy component/routes/RequireAuth/menu/query thật, chỉ mock HTTP (AuthContext fixture hiện hữu, Date.now cố định trong test). Bao phủ server totals, nhiều trang active (task ưu tiên ở trang cuối), due boundaries/overdue/completed exclusion, unknown priority, role denial cả custom permission, anonymous/auth loading, loading/empty, 403/404, network retry/recovery, cap/partial/changed/duplicate/malformed page, cancel signal, user switch/cache isolation và invalidation prefix OWN.
- 375px **jsdom smoke** chỉ đặt innerWidth và kiểm tra DOM/mobile-first classes, wrap/focus/labels; jsdom không layout/render media queries. **Chưa manual browser QA**, không có bằng chứng viewport 375px thực tế, keyboard/contrast/overflow thực tế, live authenticated API hoặc CI head mới. Không coi mock HTTP là kiểm chứng backend authorization.

| Lệnh tại frontend | Kết quả local lượt #65 |
|---|---|
| `npx --no-install prettier --write` chỉ 7 file TS/TSX thay đổi | PASS |
| `npx --no-install prettier --check "src/features/staff-dashboards/*.{ts,tsx}" "src/app/router.tsx" "src/features/auth/UserMenu.tsx"` | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS sau sửa typing params trong tests; không nới config |
| `npm test` | PASS: 90 tests / 10 files, gồm 25 tests dashboard mới |
| `npm run build` | PASS; warning chunk >500 kB không chặn build |
| `git diff --check` | PASS sau cập nhật tài liệu và lượt validation cuối |

- Files: `frontend/src/features/staff-dashboards/{api.ts,hooks.ts,routes.tsx,StaffDashboardPage.tsx,staff-dashboards.test.tsx}`, router, UserMenu và tài liệu này. Không thay Task API/lifecycle BE.
- Cần parent/reviewer: review UX/metric definitions, QA browser desktop/375px + keyboard, hai staff thật đổi session/không thấy dữ liệu chéo, task update rồi về dashboard, giới hạn/snapshot, và xác nhận H10 integration khi shell có thật; chưa đánh dấu Done.

## 10. Jira #67 / UC38 Update Task Progress (lịch sử triển khai trước merge)

> #67 đã MERGED qua PR #18 tại `341f87f`. Các phát biểu pending/CI/chưa merge bên dưới giữ bằng chứng ở mốc triển khai trước merge; không phải trạng thái hiện tại. Xem mục 11 cho lượt #65.

### Contract backend và thông báo thay đổi hành vi

- `PATCH /api/v1/tasks/:id/progress`, JSON chỉ nhận `status: "IN_PROGRESS"` hoặc `status: "COMPLETED"` và `workResult` khi hoàn thành. Completion bắt buộc string trim còn 1–2000 ký tự; bắt đầu không nhận workResult. Response 200 cùng `AssignedTaskDto` như GET detail, không trả raw document/assignedTo; `sourceSummary: null` không đổi.
- Actor chỉ từ `@CurrentUser().id`, không nhận actor/userId/assignedTo/assigneeId, expectedStatus hoặc completedAt từ client. Service suy ra trạng thái cũ; chỉ ASSIGNED → IN_PROGRESS → COMPLETED, không skip/replay/reverse. Completion ghi workResult đã trim và timestamp UTC từ server.
- AuthGuard/RolesGuard: SERVICE_STAFF hoặc OPERATIONS_STAFF hoặc custom role active có `task:execute`; chỉ task **OWN**. Precheck ownership: ID sai/không tồn tại/thuộc người khác → 404. Sai lifecycle/stale status/CAS thua race → 409; body sai/field lạ/kết quả không hợp lệ → 400; anonymous → 401, không quyền → 403. Write CAS khóa cả `_id` + `assignedTo` + expected status.
- **Thông báo contract cần gửi nhóm (Lâm và chủ module nguồn):** transition nội bộ nay cho user active với custom role active có `task:execute` thực hiện task OWN. Đây là thay đổi so với core #64 lịch sử vốn từ chối custom role, không phải chỉ thêm HTTP wrapper. Built-in role vẫn kiểm tra chuyên môn theo nguồn; `create` vẫn giữ policy chuyên môn bảo thủ, không cho custom permission thay specialization. Chưa có bằng chứng nhóm đã được thông báo/đồng ý; không coi tài liệu này là approval.
- Không tự đóng Issue, không ghi Service Order/Issue/Maintenance, không cập nhật nguồn khi completion. Mapping collection giả định, contract quyền đọc/soft-delete, source summary thật và seed vẫn deferred như mục 3; read API UC37 không đổi ownership/filter/projection/fallback.

### Frontend

- Detail `/staff/tasks/:id`: ASSIGNED có nút bắt đầu; IN_PROGRESS có form kết quả bắt buộc, trim và kiểm tra 1–2000 ký tự; COMPLETED hiển thị kết quả/thời gian, không có chuyển trạng thái tiếp.
- Shared API client gửi PATCH thật với payload allowlist; mutation không retry tự động, không optimistic update. Thành công dùng response server làm dữ liệu detail rồi invalidate/refetch detail và các list của current user; 409 cũng invalidate/refetch để lấy trạng thái authoritative trước khi thử lại.
- Pending/refetch disable controls, có ref guard chống double submit; có thông báo thành công/lỗi 400/403/404/409/network, 403/404 chặn submit tiếp. Không đổi H10/layout, menu/route hoặc API đọc UC37.

### Kiểm chứng và giới hạn bằng chứng

Đã đối chiếu source BE/FE thực tế trong lượt chỉ cập nhật tài liệu này và chạy lại `npm run lint`, `npm run typecheck` ở cả backend/frontend: PASS. Bảng dưới là **kết quả parent đã chạy khi triển khai**; không chạy lại format/tests/build trong lượt tài liệu, không phải CI hoặc manual browser QA. `npm test` của parent chạy bình thường, không override timeout.

| Phạm vi | Lệnh parent đã chạy | Kết quả |
|---|---|---|
| Backend | `npm run format:check`, `npm run lint`, `npm run typecheck` | PASS |
| Backend | `npm test` | PASS: 290 tests, 17 files |
| Backend | `npm run build` | PASS |
| Frontend | `npm run format:check`, `npm run lint`, `npm run typecheck` | PASS |
| Frontend | `npm test` | PASS: 65 tests, 9 files |
| Frontend | `npm run build` | PASS; chunk-size warning không chặn build |
| Mongo e2e | `backend/test/tasks.e2e-spec.ts` mở rộng UC38 | **Chưa chạy local**: DB cô lập an toàn chưa xác minh; CI pending |

- BE agent từng gặp invoice test timeout một lần trong `npm test`; parent chạy lại suite bình thường đã PASS như bảng, không tăng timeout hoặc che lần lỗi transient này.
- Unit/isolated HTTP tests và FE tests kiểm tra lifecycle, input/security, custom role OWN, CAS, source không bị ghi, form/payload, pending/double-submit, lỗi/refetch và read regression; không thay thế Mongo concurrency thật hoặc QA trình duyệt.
- E2e mới viết gồm race start/completion (một 200, một 409), custom role OWN, invalid/foreign/unauthorized, response bằng GET detail, replay/skip và Issue trước/sau không đổi. Fixture/cleanup giới hạn ID task/user/role/issue riêng của suite, không drop DB/xóa toàn collection. Chưa chạy nên không báo PASS.
- Manual browser QA, viewport **375px**, nguồn thật và CI head #67 **chưa xong**. #67 vẫn Implemented/pending PR review, không Done; commit/PR để parent thực hiện sau.

### Workflow API / manual QA cần chạy (chưa chạy)

1. Dùng môi trường test được phép, staff A/B và custom role active có `task:execute`; lấy task OWN qua `GET /api/v1/tasks/me`, mở detail và kiểm tra foreign ID trả 404. Không dùng ID bịa làm nguồn/seed.
2. Với task OWN ASSIGNED, gửi `PATCH /api/v1/tasks/:id/progress`, `Content-Type: application/json`, bearer token của actor, body `{"status":"IN_PROGRESS"}`; sau đó `{"status":"COMPLETED","workResult":"  Đã thực hiện công việc  "}`. Không gửi client actor, expectedStatus, timestamp hay skip ASSIGNED → COMPLETED. Kiểm tra response DTO, kết quả đã trim, completedAt server và GET/list sau refresh.
3. Thử body lạ/actor injection/status sai/kết quả trắng hoặc quá 2000 → 400; skip/replay/stale → 409; anonymous → 401, role không quyền → 403, foreign/missing/malformed ID → 404. Kiểm tra custom role chỉ đổi OWN, built-in vẫn đúng specialization và create không bị nới quyền.
4. Kiểm tra form start/complete, pending và double click, lỗi mạng/400/403/404/409, refetch list/filter/detail authoritative; task hoàn thành không đóng Issue/ghi nguồn. GET nguồn thiếu vẫn trả task, `sourceSummary: null`, không lộ dữ liệu nguồn.
5. Kiểm tra desktop/mobile **375px**, keyboard/focus, text dài và trạng thái hoàn thành; ghi bằng chứng sau khi chạy, không suy ra PASS từ component tests.

### File tham chiếu review/bàn giao

- BE endpoint/validation: `backend/src/modules/tasks/tasks.controller.ts:53`, `backend/src/modules/tasks/dto/update-task-progress.dto.ts:5`; response allowlist: `backend/src/modules/tasks/tasks.service.ts:116`.
- Ownership wrapper và eligibility mới: `backend/src/modules/tasks/tasks.service.ts:235`, `backend/src/modules/tasks/tasks.service.ts:255`; CAS/completion: `backend/src/modules/tasks/tasks.service.ts:271`; create/specialization giữ nguyên: `backend/src/modules/tasks/tasks.service.ts:137`, `backend/src/modules/tasks/tasks.service.ts:213`.
- BE tests: `backend/src/modules/tasks/tasks.spec.ts`, `backend/src/modules/tasks/tasks.controller.spec.ts`; Mongo e2e chưa chạy: `backend/test/tasks.e2e-spec.ts:163`, `backend/test/tasks.e2e-spec.ts:196`.
- FE payload/API: `frontend/src/features/tasks/api.ts:39`; mutation/invalidation: `frontend/src/features/tasks/hooks.ts:28`; form/chống double-submit: `frontend/src/features/tasks/pages/AssignedTaskDetailPage.tsx:10`; tests: `frontend/src/features/tasks/tasks.test.tsx`.

## 9. PROMPT03 — Jira #66 / UC37 View Assigned Tasks (lịch sử triển khai trước merge)

> #66 đã MERGED qua PR #17 tại `53401ad`. Các phát biểu pending/chỉ đọc/chưa có UC38, số tests và QA bên dưới là bằng chứng ở mốc UC37 trước merge, không phải hiện trạng #67; xem mục 10.

### Phạm vi đã triển khai và bảo mật

- Backend: `GET /api/v1/tasks/me` và `GET /api/v1/tasks/:id`. Actor chỉ lấy từ `@CurrentUser().id`; không nhận `userId`/`assignedTo` do client gửi. List, total và detail đều lọc `assignedTo` của actor; detail ID sai/không tồn tại/thuộc người khác cùng trả 404 để không tiết lộ quyền sở hữu.
- AuthGuard/RolesGuard toàn cục: SERVICE_STAFF **hoặc** OPERATIONS_STAFF **hoặc** custom role đang active có `task:execute`. Đây là quyền đọc UC37, không thay đổi policy chuyên môn bảo thủ của create/transition nội bộ #64. Không cho Manager xem tất cả task chỉ vì là Manager.
- Query có status, taskType chính xác, keyword tiêu đề literal (escape regex), page/limit có validation và giới hạn; sort ổn định `assignedAt` giảm dần rồi `_id` giảm dần. Field query lạ bị 400; không có endpoint liệt kê task người khác.
- Response dùng projection allowlist và DTO, không trả document nguồn hoặc tùy ý populate. Giữ `sourceType`/`sourceId` để trace và **`sourceSummary: null`**. Null là fallback an toàn về privacy khi chưa có contract quyền đọc nguồn, không phải khẳng định nguồn đã mất hoặc đã được kiểm tra. Read không query collection nguồn: thiếu/xóa nguồn vẫn trả task được giao, không biến thành 404 task.
- **Deferred:** tích hợp summary nguồn thật chỉ sau khi chủ module xác nhận schema, mapping collection và contract ủy quyền đọc/soft-delete. Không mở rộng thông tin Service Order/Issue/Maintenance, không đoán trường nghiệp vụ. Giữ các giả định `TASK_SOURCE_COLLECTIONS` của #64 và hoãn seed nguồn thật; không dùng e2e fixture làm seed nghiệp vụ.
- Frontend: `/staff/tasks` và `/staff/tasks/:id`, gọi API thật qua shared API client và TanStack Query; query key có current user ID. Có lọc/phân trang, loading/empty/error, xử lý 403/404 và thông báo nguồn không khả dụng; không có permanent mock hoặc link mở nguồn chưa được ủy quyền. Mock chỉ nằm trong tests.
- Menu “Công việc được giao” hiển thị cho service staff/operations staff hoặc role có `task:execute`, cùng policy với route. H10 vẫn chưa thay shell: router tiếp tục dùng `PublicLayout`, chỉ thêm feature routes/menu vào cấu trúc hiện hữu.
- Chỉ đọc UC37: không có POST/PATCH/DELETE task, nút bắt đầu/hoàn thành hay API đổi trạng thái UC38; `transitionAssignedTask` vẫn là API service nội bộ #64.

### Kiểm chứng và giới hạn bằng chứng

Kết quả triển khai do agents bàn giao dưới đây; lượt cập nhật tài liệu đã đối chiếu source/Git và chạy lại `npm run lint`, `npm run typecheck` tại cả backend/frontend: PASS. Không coi các kết quả này là CI hoặc manual browser QA. Không cài lại dependencies, format-write, build hay chạy lại tests trong lượt chỉ sửa tài liệu này.

| Phạm vi | Lệnh / bước đã chạy khi triển khai | Kết quả bàn giao |
|---|---|---|
| Backend | `npm run format:check`, `npm run lint`, `npm run typecheck` | PASS |
| Backend | `npm test` | PASS: 262 tests, 17 files |
| Backend | `npm run build` | PASS |
| Frontend | `npm ci` với lockfile hiện có | PASS; không đổi dependency/lockfile |
| Frontend | Sửa lỗi TypeScript của params trong test rồi chạy `npm run format:check`, `npm run lint`, `npm run typecheck` | PASS sau sửa |
| Frontend | `npm test` | PASS: 52 tests, 9 files |
| Frontend | `npm run build` | PASS; cảnh báo bundle size không chặn build |
| Backend Mongo e2e | `backend/test/tasks.e2e-spec.ts` đã thêm | **Chưa chạy local**: chưa xác minh isolated DB an toàn; CI pending |

- Isolated HTTP tests dùng AuthGuard/RolesGuard thật nhưng mock token verifier/persistence: hai staff khác nhau chỉ thấy list/total/detail của mình, không đọc chéo; kiểm tra custom permission role, 401/403/404, query injection/ownership override, projection và không truy cập nguồn. Đây không phải kiểm chứng tích hợp nguồn thật hoặc concurrency MongoDB.
- Mongo e2e đã viết cho hai staff và custom role, missing-source fallback, lọc/phân trang và ownership. Fixture dùng ID riêng; cleanup chỉ xóa task/user/role do suite tự tạo theo ID, không drop database hoặc xóa toàn collection. Chưa chạy nên không báo PASS e2e; chỉ chạy khi có DB test cô lập được xác nhận hoặc CI phù hợp.
- FE tests kiểm tra route/menu role OR permission, request API, loading/empty/filter/page, lỗi và detail fallback không mutation. Sửa test params bằng kiểm tra object và numeric page, không nới typecheck hoặc bỏ assertion.
- **Chưa manual browser QA**, chưa xác nhận responsive ở viewport 375px, chưa QA nguồn thật; CI cho thay đổi #66 còn pending. #66 không Done, chưa có commit/PR trong mốc bàn giao này.

### Manual QA cần thực hiện (chưa chạy)

1. Dùng môi trường test được phép và hai staff A/B có task riêng: đăng nhập từng người, mở list/detail, xác nhận tổng/phân trang không lộ task người còn lại; nhập URL task B khi là A phải nhận 404.
2. Kiểm tra anonymous, role không quyền và custom role active có `task:execute`; thử query `userId`/`assignedTo` phải bị từ chối. Xác nhận menu/route không thay thế authorization backend.
3. Kiểm tra lọc status/taskType/keyword literal, đổi trang/reset bộ lọc, loading/empty/lỗi mạng/403/404 và retry; task thiếu nguồn vẫn có detail, `sourceSummary: null`, không link hoặc lộ nội dung nguồn.
4. Kiểm tra desktop và mobile **375px**, keyboard/focus và trạng thái dài; ghi kết quả thực tế sau khi chạy. Không đánh dấu bước này đã PASS từ component tests.

### File tham chiếu để review/bàn giao

- BE controller và DI: `backend/src/modules/tasks/tasks.controller.ts`, `backend/src/modules/tasks/tasks.module.ts`; read scope/projection/serialization: `backend/src/modules/tasks/tasks.service.ts`.
- Contract response/query: `backend/src/modules/tasks/dto/assigned-task.dto.ts`, `backend/src/modules/tasks/dto/list-assigned-tasks.dto.ts`; security tests: `backend/src/modules/tasks/tasks.controller.spec.ts`; Mongo e2e chưa chạy: `backend/test/tasks.e2e-spec.ts`.
- FE API/query/route: `frontend/src/features/tasks/api.ts`, `frontend/src/features/tasks/hooks.ts`, `frontend/src/features/tasks/routes.tsx`; UI: `frontend/src/features/tasks/pages/AssignedTasksPage.tsx`, `frontend/src/features/tasks/pages/AssignedTaskDetailPage.tsx`, `frontend/src/features/tasks/TaskPresentation.tsx`, `frontend/src/features/tasks/presentation.ts`.
- Router/menu/tests: `frontend/src/app/router.tsx`, `frontend/src/features/auth/UserMenu.tsx`, `frontend/src/features/tasks/tasks.test.tsx`. Hướng dẫn auth/API/route dùng lại: `docs/TIEN-DO-DUONG.md`, `docs/HUONG-DAN-TRIEN-KHAI.md`.

## 8. Jira #64 — Task Core (mốc triển khai trước merge, lịch sử)

> Các phát biểu “không có controller/UI”, “pending PR” và số test ở mục này mô tả mốc #64 trước merge, không phải hiện trạng #66. #64 đã MERGED tại `4046fe0`; contract nội bộ và rủi ro tích hợp bên dưới vẫn cần lưu ý.

### API nội bộ và phạm vi ủy quyền

Giữ nguyên `create(input: CreateTaskDto)`, enum status/source và hàm thuần H8. Không đăng ký HTTP. Module gọi phải import `TasksModule`; ví dụ DI thực tế (đường dẫn tính từ `src`):

```ts
import { Injectable, Module } from '@nestjs/common';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { TasksService } from './modules/tasks/tasks.service.js';
import { TaskStatus } from './modules/tasks/task-contract.js';

@Injectable()
class TaskConsumer {
  constructor(readonly tasks: TasksService) {}

  start(taskId: string, authenticatedUserId: string) {
    return this.tasks.transitionAssignedTask(
      taskId,
      authenticatedUserId,
      TaskStatus.Assigned,
      TaskStatus.InProgress,
    );
  }
}

@Module({ imports: [TasksModule], providers: [TaskConsumer] })
class ConsumerModule {}
```

- API mới: `transitionAssignedTask(taskId: string, actorUserId: string, expectedStatus: TaskStatus, nextStatus: TaskStatus, workResult?: string)`, trả document đã cập nhật. Chỉ ASSIGNED → IN_PROGRESS → COMPLETED; không có cập nhật trạng thái tùy ý, quyền manager override, reassignment hoặc sửa lịch sử.
- Caller là trusted application service: phải xác thực người gọi và lấy `actorUserId` từ `AuthUser.id` do AuthGuard thiết lập, không lấy từ request body/Firebase UID; guard/permission của endpoint tương lai vẫn do caller chịu trách nhiệm. RolesGuard có thể cho custom role qua permission nhưng không chứng minh chuyên môn, nên core vẫn từ chối custom role. Giữ constructor/model Role của H8 để không phá DI hiện hữu; không còn dùng permission như fallback specialization.
- Create: caller phải kiểm tra quyền giao việc, scope, accepted ServiceOrder/reviewed Issue và tính phù hợp taskType/tính chất issue. Core chỉ biết enum nguồn, taskType chuỗi không trắng và role chuyên môn theo nguồn; không đặt enum taskType, không đoán schema nguồn. Nguồn thật chưa tích hợp, chưa được coi là UC26/UC31 hoàn chỉnh.
- Transition kiểm tra actor đang active và chuyên môn theo nguồn, đọc task trong scope assignedTo + expectedStatus rồi CAS cùng scope. Stale/missing/out-of-scope đều 409 để không lộ task người khác. Không có unconstrained status edit. Source/taskType không có API sửa; không hỗ trợ raw model writes từ caller. Việc khóa user đồng thời với write không có transaction xuyên collection; eligibility là snapshot tại thời điểm kiểm tra.
- Completion yêu cầu workResult kiểu string không trắng; trim và ghi completedAt từ `new Date()` (UTC instant của server), không nhận completion time từ caller. Bắt đầu không nhận workResult. Không tự đóng Issue hoặc sửa nguồn.

### Work identity, atomic index và migration

- **Cùng công việc = cùng sourceType + sourceId + taskType đã trim**, so sánh chuỗi case-sensitive mặc định MongoDB; title hoặc assignee không thuộc identity. Title có thể sửa cách diễn đạt và đổi người không tạo thành công việc mới. Caller phải dùng taskType ổn định/canonical khi tích hợp; không dùng title/ID ngẫu nhiên làm taskType để né uniqueness.
- Index unique chỉ áp dụng ASSIGNED/IN_PROGRESS, cho phép nhiều taskType trên nguồn và task mới sau khi task trước COMPLETED. Schema có index thật; service gọi `collection.createIndex` đúng definition trước create/CAS, dùng chung promise trong instance. Không dựa vào preflight `exists`, không dựa autoIndex bật. E11000 khi create hoặc build index → ConflictException; lỗi DB khác giữ nguyên, không giả thành duplicate.
- **Migration risk:** duplicates active có sẵn khiến build index thất bại, service fail closed và không write; promise lỗi được giữ tới khi khởi động lại instance. DBA phải audit và xử lý bằng quy trình nghiệp vụ được duyệt rồi restart; không tự xóa/dedupe dữ liệu, không syncIndexes/dropIndex. Runtime cần quyền createIndex, kể cả deployment tắt autoIndex; index không tạo được thì không write. Không bảo vệ raw writes bỏ qua service hoặc operator xóa index sau khi khởi tạo.
- Mapping `serviceorders` / `issues` / `maintenances` vẫn là giả định explicit chưa xác nhận, không thêm schema nguồn. Core chỉ query `_id`; nguồn thiếu → 404, lỗi nguồn DB truyền ra. Không dùng fake/dangling source IDs, tiếp tục hoãn seed tới khi có nguồn thật. Kiểm tra source tồn tại không giải quyết xóa nguồn đồng thời; chính sách bảo toàn reference do module nguồn thống nhất.
- Error contract: input/ID/enum/field lạ không hợp lệ → 400; assignee hoặc source không tồn tại khi create → 404; inactive/ineligible assignee → 400; lifecycle sai, duplicate active work, index có duplicates, stale/foreign/missing task CAS → 409; completion/result sai → 400. Missing actor record khi transition → 404. Validation/lifecycle/eligibility lỗi không gọi update.

### Kiểm chứng local

Chỉ thay `tasks.service.ts`, `tasks.spec.ts`, `schemas/task.schema.ts` và tài liệu này. Không đổi các task #65–80, dependency/config, controller hoặc seed. Đã đọc SRS UC26/31/35–38, BR-TASK-01–05 và ERD ngoài repo; không đọc env/secrets.

| Lệnh tại `backend` | Kết quả |
|---|---|
| `npx --no-install prettier --write "src/modules/tasks/**/*.ts"` | PASS, chỉ format file sở hữu |
| `npm test -- src/modules/tasks/tasks.spec.ts` | PASS: 83 tests |
| `npm run format:check` | PASS toàn backend |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS: 16 files, 234 tests |
| `npm run build` | PASS |

Tests dùng mock persistence theo H8, schema/index Mongoose thật in-memory, concurrent atomic persistence simulation (không phải MongoDB concurrency thật), Nest DI, validation/source/assignee/chuyên môn, index failure/duplicate/lỗi DB, toàn bộ lifecycle edges và CAS race, completion/result/UTC. Có warning Mongoose validateSync deprecated và vite-tsconfig-paths có thể thay bằng native Vite; không đổi config/dependency ngoài scope. Không thêm/chạy real DB e2e local vì chưa xác minh DB cô lập an toàn; không tuyên bố đã QA nguồn thật hoặc CI cho head chưa commit. Pending QA/PR, không Done.

## 7. Đồng bộ origin/main và xử lý conflict (lịch sử trước khi PR #15 merged)

- Người dùng đã cho phép merge main vào feature; đã fetch và xác nhận working tree sạch trên `feature/H8-task-contract` trước merge.
- Merge `origin/main@4134194` bằng merge thường, không rebase/reset/force-push, không sửa local main.
- Chỉ conflict `backend/src/app.module.ts`, tại imports và danh sách module: giữ TasksModule của H8 cùng AmenitiesModule/RoomTypesModule từ main. Không chọn nguyên file ours/theirs; không đổi business rule/public contract.
- Các sửa formatting `57e572e` và UC49 từ main được giữ. Diff so với main chỉ còn H8, đăng ký TasksModule và tài liệu Vũ; source H8 không thay đổi trong merge.
- Sau giải quyết: `npm run format:check` PASS, `npm run lint` PASS, `npm run typecheck` PASS, `npm test` PASS (16 files, 205 tests), `npm run build` PASS, `git diff --check` PASS. Nest injection/schema export tests H8 nằm trong unit suite đã pass.
- Không chạy E2E local vì chưa xác minh được database test cô lập an toàn; CI sẽ chạy với service MongoDB test của workflow. Không dùng DB cấu hình cá nhân để thử.
- Merge commit đã push thường: `4fe5f4b`. Run `39959288699` cho đúng head này PASS cả backend/frontend/docker; backend format/lint/typecheck/unit/e2e/build đều SUCCESS. E2E CI chạy với MongoDB test của workflow, không phải xác nhận nguồn ServiceOrder/Issue/Maintenance production đã tích hợp.
- GitHub xác nhận `MERGEABLE / CLEAN`, PR vẫn draft và chưa có review approval. H8 vẫn Implemented / PR pending review, không phải đã merge; nguồn thật và mapping collection cần chủ module xác nhận như mục 3. Sẵn sàng review kỹ thuật, không tự tuyên bố đã được duyệt merge.
- Không merge PR #15, không triển khai PROMPT 02.

## 1. Trạng thái task

| # | Task | Trạng thái | Commit/PR |
|---|---|---|---|
| H8 | Contract Task dùng chung | MERGED | PR #15 / main `c970bf4` |
| 64 | Task core, lifecycle, source reference | MERGED; integration assumptions nguồn thật chưa giải quyết | PR #16 / merge `4046fe0` |
| 65 | Staff / Operations Dashboard | MERGED; lịch sử QA ở mục 11 | PR #19 / merge `4213c8d` |
| 66 | UC37 View Assigned Tasks | MERGED | PR #17 / merge `53401ad` |
| 67 | UC38 Update Task Progress | MERGED; lịch sử QA và giới hạn ở mục 10 | PR #18 / merge `341f87f` |
| 68 | UC22 Create Service Order | Chưa làm | Chưa có |
| 69 | UC23 View Service Orders (Customer) | Chưa làm | Chưa có |
| 70 | UC24 View Service Order Requests | Chưa làm | Chưa có |
| 71 | UC25 Review Service Order Request | Chưa làm | Chưa có |
| 72 | UC26 Assign Service Order Task | Chưa làm | Chưa có |
| 73 | UC27 View Service History | Chưa làm | Chưa có |
| 74 | UC28 Report Issue | MERGED; đã xác minh merge; lịch sử QA ở mục 12 | PR #20 / merge `266e40b` |
| 75 | UC29 View Issue List | Implemented, pending review; không Done; e2e/CI/manual QA pending | `feature/vu-75-79-issue-list-detail`; commit/PR để parent bổ sung sau |
| 76 | UC30 Review Issue Request | Chưa làm | Chưa có |
| 77 | UC31 Assign Issue Resolution Task | Chưa làm | Chưa có |
| 78 | UC32 Close Issue | Chưa làm | Chưa có |
| 79 | UC33 View Issue Detail | Implemented, pending review; không Done; e2e/CI/manual QA pending | `feature/vu-75-79-issue-list-detail`; commit/PR để parent bổ sung sau |
| 80 | UC34 Report Service Issue | Chưa làm | Chưa có |

## 2. Contract dùng lại

Import `TasksModule` từ `modules/tasks/tasks.module.js` trong module gọi; inject `TasksService` từ `modules/tasks/tasks.service.js`. AppModule đã đăng ký TasksModule; không import ngược module nguồn nên không có vòng phụ thuộc.

`TaskStatus` / `TaskSourceType` export tại `modules/tasks/task-contract.js` và re-export từ schema:

- Status lưu DB **chính xác** `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`.
- Source lưu DB `SERVICE_ORDER`, `ISSUE`, `MAINTENANCE`; luôn bắt buộc `sourceId` ObjectId.
- `canTransitionTaskStatus(from, to)` chỉ trả true cho `ASSIGNED → IN_PROGRESS`, `IN_PROGRESS → COMPLETED`. Mọi cặp khác false, kể cả giữ nguyên trạng thái.
- Collection `tasks`: `title`, `taskType`, `priority`, `status`, `assignedTo` ref `User`, `assignedAt`, `dueAt?`, `completedAt?`, `workResult?`, `sourceType`, `sourceId`, timestamps.
- Index giữ nguyên ba index H8 và thêm `unique_active_task_work`: unique `{ sourceType: 1, sourceId: 1, taskType: 1 }`, partial `status: { $in: ['ASSIGNED', 'IN_PROGRESS'] }`. Một nguồn vẫn có nhiều loại công việc; xem mục 8 về work identity và migration.
- ERD/SRS chưa chốt tập giá trị taskType/priority: giữ chuỗi không trắng, không tự đặt enum nghiệp vụ. `SERVICE`/`NORMAL` dưới đây chỉ là chuỗi minh họa.

Ví dụ gọi nội bộ, các biến `persistedServiceOrder` và `activeStaff` phải là bản ghi thật đã được caller lấy từ DB, không dùng ID mẫu:

```ts
import { TaskSourceType } from './modules/tasks/task-contract.js';

const task = await tasksService.create({
  title: 'Deliver towels',
  taskType: 'SERVICE',
  priority: 'NORMAL',
  sourceType: TaskSourceType.ServiceOrder,
  sourceId: String(persistedServiceOrder._id),
  assigneeId: String(activeStaff._id),
  dueAt: '2026-11-01T08:00:00Z',
});
```

`CreateTaskDto`: title/taskType/priority không trắng, sourceType enum, sourceId/assigneeId MongoId, dueAt ISO date hợp lệ nếu có (không nhận null). Service tự validate và từ chối field lạ kể cả caller không qua ValidationPipe. Không nhận status/completedAt/workResult/assignedAt từ caller khi tạo; luôn lưu ASSIGNED, assignedAt hiện tại. Trả về document thật từ `Model.create`, không giả lập persist.

## 3. Phụ thuộc và giới hạn

- Khi **create**, assignee phải tồn tại và `isActive === true`: SERVICE_ORDER chỉ SERVICE_STAFF (UC26/BR-SER-07), ISSUE nhận SERVICE_STAFF hoặc OPERATIONS_STAFF (UC31/BR-ISS-06), MAINTENANCE chỉ OPERATIONS_STAFF (actor UC35/36). Không suy diễn chuyên môn từ permission `task:execute`; create vẫn từ chối custom roles bảo thủ. Transition #67 khác policy core lịch sử: custom role active có `task:execute` được thực hiện task OWN, built-in vẫn kiểm tra specialization; cần thông báo nhóm, chưa xác nhận approval (mục 10). ISSUE còn cần caller xác nhận chuyên môn theo tính chất issue/taskType vì chưa có taxonomy/schema nguồn.
- Service nội bộ không xác thực người tạo task. Caller tương lai chịu trách nhiệm quyền tạo/giao việc và scope nguồn; `AuthUser.id` là User ID, không dùng Firebase UID làm assigneeId.
- Validation hình dạng ID **khác** kiểm tra tồn tại: sau validation, service query DB thật bằng injected Connection với `_id` và projection `_id`.
- Mapping collection explicit trong `TASK_SOURCE_COLLECTIONS`: SERVICE_ORDER → `serviceorders`, ISSUE → `issues`, MAINTENANCE → `maintenances`. #74 đã có schema Issue thật tại collection `issues`, khớp mapping hiện hữu; không còn coi Issue schema là chưa tồn tại. Mapping/tích hợp Service Order và Maintenance vẫn cần chủ module xác nhận; Issue còn thiếu contract review/quyền đọc/soft-delete/source summary và giao task (mục 12). Không nhận tên collection từ caller. Nguồn/collection không tồn tại → từ chối tạo; lỗi DB truyền ra, không persist giả.
- Không kiểm tra trạng thái duyệt/quyền xem/soft-delete của nguồn khi chưa có schema nguồn; caller nghiệp vụ phải bổ sung khi tích hợp. Kiểm tra tồn tại tại thời điểm tạo không thay thế transaction hoặc chính sách cấm xóa nguồn sau này.
- **Hoãn seed Task/Issue**: có schema Issue không đồng nghĩa đã có context seed hợp lệ. Chờ User/Booking/Room và nguồn thật hợp lệ theo thứ tự phụ thuộc, môi trường cô lập được phép và cùng validation; không thêm ID bịa, sửa seed người khác hoặc ghi DB dùng chung.
- Core #64 đã có `transitionAssignedTask` kiểm tra assignedTo + trạng thái cũ bằng CAS; #67 bổ sung UC38 HTTP với ownership precheck 404 và response DTO (mục 10). Task hoàn thành không đồng nghĩa tự đóng Issue, không ghi nguồn.

## 4. QA và bàn giao (lịch sử H8; xem mục 9 cho lịch sử UC37, mục 10 cho hiện trạng UC38)

Đã thêm unit test lifecycle toàn bộ 9 cặp enum và giá trị ngoài enum, schema/default/index, Nest injection, DTO và service validation, assignee/permission, mapping và nguồn không tồn tại, persistence/lỗi DB. Model và Connection được mock trong test service; schema validation chạy in-memory. **Không phải** kiểm thử tích hợp MongoDB hay nguồn thật.

Lần triển khai ban đầu chạy từ thư mục `backend` (chưa cài dependency, không chạy DB):

| Lệnh chính xác | Kết quả |
|---|---|
| `npm run lint` | Không chạy được: `oxlint` not recognized |
| `npm run typecheck` | Không chạy được: `tsc` not recognized |
| `npm test -- src/modules/tasks/tasks.spec.ts` | Không chạy được: `vitest` not recognized |
| `npm run build` | Không chạy được: `nest` not recognized |

Kết quả ban đầu được giữ làm lịch sử; kết quả chạy lại nằm ở mục 5. Chưa xác nhận merge. Bàn giao contract qua PR cho Lâm/Hiếu/Khoa, chưa xác nhận nhóm đã tiếp nhận.

## 6. Xác minh lại sau khi main cập nhật (lịch sử trước merge H8)

- Đã fetch; working tree sạch trước kiểm tra, vẫn ở `feature/H8-task-contract`. PR head được kiểm tra: `2473b8205fd983b0e570a2d8ebbf7555b51940c5`.
- Đúng run của head này: `39939610125`, backend FAIL tại format:check, frontend PASS, docker SKIPPED; các bước backend typecheck/unit/e2e/build bị CI skip sau lỗi format.
- H8: `npx --no-install prettier --check "src/modules/tasks/**/*.ts"` PASS, không sửa thêm source H8.
- **Kết luận mới thay thế blocker cũ:** `origin/main` hiện là `4134194ab4b99b60e92af07d891e6f2ee26f53e6`, đã có commit `57e572e` sửa formatting kế thừa. Kiểm tra Prettier toàn bộ backend của main trong detached worktree riêng PASS; dùng executable Prettier đã cài tại repo, không cài/sửa file trong worktree. Worktree kiểm tra đã được gỡ sạch.
- Run main mới `39951483423` có conclusion SUCCESS. Vì vậy không được nói main hiện tại vẫn fail format: lỗi chỉ còn trên nhánh PR dùng base cũ `9a0fb22`.
- Đã chạy lại tại branch PR: lint PASS, typecheck PASS, unit tests 184/184 PASS (15 files), build PASS; format toàn backend vẫn FAIL 24 file bên dưới. E2E local chưa chạy vì chưa xác minh DB test an toàn.
- GitHub báo PR `mergeable: CONFLICTING`, `mergeStateStatus: DIRTY`. Chưa tự merge/rebase/main sync và chưa giải quyết conflict ngoài phạm vi.
- Hướng xử lý: phối hợp Dương xác nhận bản sửa formatting đã ở main; không cần tạo PR formatting trùng lặp. Xin xác nhận cập nhật nhánh H8 từ main và giải quyết conflict có kiểm soát, sau đó chạy lại format/lint/typecheck/unit/e2e/build và kiểm tra CI head mới. Nếu còn lỗi formatting ngoài H8 sau đồng bộ, tách PR chỉ-format được Dương đồng ý thay vì đưa vào PR #15.
- PR #15 vẫn draft, chưa an toàn merge; không merge, không bắt đầu PROMPT 02.

24 file lỗi trên nhánh PR, kế thừa từ main cũ (main hiện tại đã sạch):

```text
backend/src/modules/bookings/availability.adapters.ts
backend/src/modules/bookings/availability.core.spec.ts
backend/src/modules/bookings/availability.core.ts
backend/src/modules/bookings/availability.service.spec.ts
backend/src/modules/bookings/availability.service.ts
backend/src/modules/bookings/bookings.module.ts
backend/src/modules/bookings/schemas/booking.schema.ts
backend/src/modules/bookings/schemas/room-hold.schema.ts
backend/src/modules/bookings/schemas/schemas.spec.ts
backend/src/modules/bookings/seed.ts
backend/src/modules/invoices/invoice-adapters.spec.ts
backend/src/modules/invoices/invoice-adapters.ts
backend/src/modules/invoices/invoice-calculator.spec.ts
backend/src/modules/invoices/invoice-calculator.ts
backend/src/modules/invoices/invoices.module.ts
backend/src/modules/invoices/invoices.service.spec.ts
backend/src/modules/invoices/invoices.service.ts
backend/src/modules/invoices/schemas/invoice-charge.schema.ts
backend/src/modules/invoices/schemas/invoice.schema.ts
backend/src/modules/payments/payments.module.ts
backend/src/modules/payments/schemas/payment-transaction.schema.ts
backend/test/availability.e2e-spec.ts
backend/test/h5-schemas.e2e-spec.ts
backend/test/invoices.e2e-spec.ts
```

## 5. FIX PROMPT 01 — Backend CI (lịch sử)

- Run PR lỗi: `39937737755`, HEAD `5ede98f`, step `Run npm run format:check` exit 1: 29 file sai Prettier, gồm 5 file H8 và 24 file có sẵn từ base.
- Base `main@9a0fb22` cũng lỗi step format trong run `39926213558`. Các file Bookings/Invoices/Payments và e2e bị báo không có thay đổi trong PR. Không sửa format ngoài phạm vi để tránh overlap; đây là blocker CI kế thừa cần chủ module xử lý hoặc cho phép PR format riêng.
- Đã format các file H8 bằng Prettier hiện có trong lockfile, không đổi dependencies/config CI/assertions.
- Khi chạy đầy đủ unit tests local, phát hiện thêm lỗi H8: TasksModule import UsersModule kéo theo FirebaseModule yêu cầu ConfigService trong bài test injection cô lập. Đã đăng ký lại chính UserSchema/RoleSchema hiện hữu bằng MongooseModule.forFeature, không sao chép/sửa schema và không phụ thuộc Firebase. Giữ nguyên test injection và assertions; test đã pass.

| Lệnh tại `backend` | Kết quả thực tế sau sửa |
|---|---|
| `npm ci` | Thành công với lockfile hiện có; có cảnh báo dependency deprecated/install scripts, không đổi package/lockfile |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS: 15 files, 184 tests, gồm 54 tests H8 |
| `npm run build` | PASS |
| `npx --no-install prettier --check "src/modules/tasks/**/*.ts"` | PASS |
| `npm run format:check` | FAIL: 24 file Bookings/Invoices/Payments/e2e kế thừa, không còn file H8 |
| `git diff --check` | PASS |

Chưa chạy e2e local vì chưa xác minh MongoDB test an toàn. Fix đã commit/push: `dfda524` (`fix(tasks): resolve H8 formatting and isolated module injection`). Đã kiểm tra run sau push `39939399103`: frontend PASS, backend FAIL tại format:check với đúng 24 file kế thừa, không còn file H8; docker SKIPPED. Không báo H8 Done hoặc PR sẵn sàng merge khi backend check còn fail. Source integration vẫn cần xác nhận mapping collection và nguồn thật; unit tests mock DB không thay thế tích hợp đó.
