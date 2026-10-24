# Tiến độ phần việc của Vũ

> Bàn giao authoritative cho thành viên và AI agent trước khi code; cập nhật 25/10/2026. Thay thế lịch sử triển khai/pending cũ trong tài liệu này.
> Baseline được bàn giao: `feature/vu-final-integration-qa`, PR #32 đã merge tại `f51f298`. Lượt hợp nhất tài liệu không thao tác Git, không sửa production/test/seed/config.
> Bố cục theo [TIEN-DO-DUONG.md](TIEN-DO-DUONG.md): trạng thái → dùng lại → bàn giao → lưu ý → hạn chế → kiểm tra nhanh.

## Đọc nhanh

- **Tổng thể PARTIAL, không phải toàn bộ BLOCKED hoặc DONE.** Backend A/B/C đã hoạt động trên nguồn persist thật qua real AppModule/Mongo E2E, không thay dependency bằng mock; authenticated browser acceptance chưa thực hiện nên tất cả task vẫn PARTIAL ở mức nghiệm thu.
- H8/core đã có persistence, lifecycle, CAS và chống trùng active work. `SERVICE_ORDER → serviceorders`, `ISSUE → issues` đã tích hợp thật; riêng `MAINTENANCE → maintenances` còn chờ contract/schema/caller của Lâm.
- H4 Service, H5 Booking và H7 Invoice là nguồn thật đang dùng. H10/layout của Khoa còn pending; frontend hiện dùng PublicLayout và menu/RequireAuth hiện hữu, không coi đây là H10 hoàn tất.
- #80 đã **MERGED**, không còn pending review trước merge hoặc lệnh cấm PROMPT13. Nhánh QA cuối có test và sửa regression; commit/PR/CI cuối chưa được cung cấp, không gán SHA baseline cho thay đổi chưa commit.
- Evidence QA dưới đây phân biệt agent, browser anonymous và parent final checks. Không suy test PASS thành authenticated UI/Firebase/CI/approval PASS.

## 1. Trạng thái task

Quy ước: **DONE** = đủ triển khai và nghiệm thu; **PARTIAL** = chức năng đã có nhưng còn acceptance/contract; **BLOCKED** = một phạm vi cụ thể không thể tiếp tục do dependency. Merge là bằng chứng code đã vào baseline, không tự động là DONE. Bảng gồm H8 và đầy đủ **17 task #64–#80**; mọi dòng còn thiếu authenticated browser acceptance.

| # | Task | Trạng thái và bằng chứng chức năng | PR đã merge / SHA |
|---|---|---|---|
| H8 | Contract Task dùng chung | **PARTIAL**: enums/helper/DI dùng lại; Maintenance chưa có contract nguồn thật | [#15](https://github.com/duongvn9/hotel-mangagement-system/pull/15) / `c970bf4` |
| 64 | Task core, lifecycle, source reference | **PARTIAL**: persist/index/CAS hoạt động với Service Order và Issue; nhánh Maintenance chờ Lâm | [#16](https://github.com/duongvn9/hotel-mangagement-system/pull/16) / `4046fe0` |
| 65 | Service / Operations Staff Dashboard | **PARTIAL**: đọc counts/list theo own Task và enum hiện hữu; không thêm dashboard API | [#19](https://github.com/duongvn9/hotel-mangagement-system/pull/19) / `4213c8d` |
| 66 | UC37 View Assigned Tasks | **PARTIAL**: own list/detail/filter/count, foreign Task 404; A/B E2E | [#17](https://github.com/duongvn9/hotel-mangagement-system/pull/17) / `53401ad` |
| 67 | UC38 Update Task Progress | **PARTIAL**: HTTP own transition/CAS/workResult; A/B/C E2E | [#18](https://github.com/duongvn9/hotel-mangagement-system/pull/18) / `341f87f` |
| 68 | UC22 Create Service Order | **PARTIAL**: own checked-in Booking + Service snapshot/idempotency; A E2E | [#27](https://github.com/duongvn9/hotel-mangagement-system/pull/27) / `a9a1525` |
| 69 | UC23 View Service Orders | **PARTIAL**: Customer own list/detail, booking ownership và DTO riêng | [#27](https://github.com/duongvn9/hotel-mangagement-system/pull/27) / `a9a1525` |
| 70 | UC24 View Service Order Requests | **PARTIAL**: Receptionist list/detail/filter và billing labels thật | [#30](https://github.com/duongvn9/hotel-mangagement-system/pull/30) / `e568713` |
| 71 | UC25 Review Service Order | **PARTIAL**: durable review + H7 charge/reconcile; A và recovery E2E | [#30](https://github.com/duongvn9/hotel-mangagement-system/pull/30) / `e568713` |
| 72 | UC26 Assign Service Order Task | **PARTIAL**: ledger gate, durable assignment, một Task khi race; A E2E | [#31](https://github.com/duongvn9/hotel-mangagement-system/pull/31) / `0c04844` |
| 73 | UC27 View Service History | **PARTIAL**: own completed/finalized work; keyword cap 100 đã sửa regression FE | [#31](https://github.com/duongvn9/hotel-mangagement-system/pull/31) / `0c04844` |
| 74 | UC28 Report Issue | **PARTIAL**: Customer report persist thật, B E2E | [#20](https://github.com/duongvn9/hotel-mangagement-system/pull/20) / `266e40b` |
| 75 | UC29 View Issue List | **PARTIAL**: Customer own scope / Receptionist / Manager và safe DTO | [#22](https://github.com/duongvn9/hotel-mangagement-system/pull/22) / `787d1b8` |
| 76 | UC30 Review Issue Request | **PARTIAL**: handling category/priority/action conclusion; B/C E2E | [#25](https://github.com/duongvn9/hotel-mangagement-system/pull/25) / `b5d2f2f` |
| 77 | UC31 Assign Issue Resolution Task | **PARTIAL**: category đúng staff, durable Task identity/recovery; B/C E2E | [#25](https://github.com/duongvn9/hotel-mangagement-system/pull/25) / `b5d2f2f` |
| 78 | UC32 Close Issue | **PARTIAL**: explicit authorized close, completed Task không auto-close; B/C E2E | [#26](https://github.com/duongvn9/hotel-mangagement-system/pull/26) / `8df46e7` |
| 79 | UC33 View Issue Detail | **PARTIAL**: role-specific detail/linked summary, foreign Customer 404 | [#22](https://github.com/duongvn9/hotel-mangagement-system/pull/22) / `787d1b8` |
| 80 | UC34 Report Service Issue | **PARTIAL**: own executing Service Task → Issue riêng; source chain/dedupe thật; C E2E | [#32](https://github.com/duongvn9/hotel-mangagement-system/pull/32) / `f51f298` |

## 2. Dùng lại được ngay

### 2.1 Nguồn thật và Task core H8

- H4: model `Service`, collection `services`, fields `isActive`, `price`, `unit`, `billable`; **không có `available`**. Catalog Customer là API scoped của Service Orders, không mở quyền Manager GET `/services`. Nonbillable hiệu lực giá 0; billable cần safe integer VND không âm.
- H5: model `Booking` thật, `customer`, `isActive`, `status`; tạo/replay Service Order cần own + active + `CHECKED_IN`. Không suy ownership từ email/phone. Read order kiểm tra cả customer gốc và customer hiện tại của Booking; đổi chủ không chuyển quyền order cho chủ mới.
- H7: `InvoicesService.getOrCreateForBooking(bookingId)` và `addCharge({ bookingId, type, amount, sourceId, reason })` thật; approved ledger và pricing thật. Service Orders không ghi trực tiếp ledger, không tạo payment; **BILLED không phải PAID**.
- Import `TasksModule` một chiều, inject `TasksService`; không clone lifecycle hoặc import ngược module nguồn. Nội bộ: `create(input: CreateTaskDto, identity?: Types.ObjectId, assignedAt?: Date)` giữ tương thích caller cũ. Identity/time optional dành cho trusted caller đã persist durable intent, không nhận tùy ý từ HTTP body.
- `TaskStatus`: **ASSIGNED → IN_PROGRESS → COMPLETED**; không skip, rollback hoặc transition cùng status. Completion bắt buộc workResult trim không trắng, tối đa 2000; completedAt giờ server. Dashboard counts dùng ba enum này, không bịa PENDING/DONE.
- `TaskSourceType`: **SERVICE_ORDER / ISSUE / MAINTENANCE**. `TASK_SOURCE_COLLECTIONS` tại `backend/src/modules/tasks/tasks.service.ts:30` lần lượt là `serviceorders / issues / maintenances`; hai mapping đầu đã được workflow thật xác nhận, mapping Maintenance chưa phải integration hoàn tất.
- Task lưu title/taskType/priority/assignee/source/time/result; taskType/priority core là chuỗi được validate, không tự đặt enum nghiệp vụ mới. Service execution dùng canonical `SERVICE_ORDER_EXECUTION`.
- `unique_active_task_work`: unique `(sourceType, sourceId, taskType)` khi ASSIGNED/IN_PROGRESS. Sau COMPLETED index này không ngăn tạo Task mới; durable assignment identity + reconcile kể cả completed mới chống duplicate retry xuyên partial failure.
- Create kiểm tra source tồn tại và User active, specialization: SERVICE_ORDER chỉ SERVICE_STAFF; ISSUE SERVICE_STAFF hoặc OPERATIONS_STAFF; MAINTENANCE chỉ OPERATIONS_STAFF. Caller chịu trách nhiệm actor, quyền/scope, source eligibility và category cụ thể; core không phải API public tạo Task.

### 2.2 Auth/RBAC: giữ đúng hai tầng policy

- AuthGuard/RolesGuard toàn cục của Dương: role nằm trong `@Roles()` **HOẶC** đủ `@Permissions()` khi role không khớp; không phải role AND permission. `RequireAuth` hỗ trợ semantics tương ứng.
- UC37/38 Task có SERVICE_STAFF/OPERATIONS_STAFF hoặc custom role active có `task:execute`; luôn own-only. Transition kiểm tra User active và specialization cho built-in; create vẫn bảo thủ, permission không thay chuyên môn.
- Service Orders, Issue workflows và UC34 dùng **exact-role** như bảng API; không tự thêm permission fallback/Manager bypass. UC34 chỉ SERVICE_STAFF, không mở general Issue read cho staff này.
- Khác biệt với hướng dẫn custom-role chung của Dương là **policy cần Dương/nhóm phê duyệt**, không silently widen hoặc bỏ service-level checks để làm UI chạy. Tài liệu không phải approval thay contract H8.

### 2.3 API hiện có — prefix `/api/v1`

Đối chiếu controllers thật, không lấy route từ lịch sử prompt. C = CUSTOMER; R = RECEPTIONIST; M = MANAGER; S = SERVICE_STAFF; O = OPERATIONS_STAFF. Các role viết riêng là exact-role; ngoại lệ Task có permission fallback nêu trên.

| Method, path sau prefix | Ai gọi | Input / contract chính |
|---|---|---|
| `GET /tasks/me` | S/O hoặc `task:execute` | Own; `status, taskType, keyword, page, limit`; `{ items, total, page, limit }` |
| `GET /tasks/:id` | Như trên | Own Task detail, foreign/malformed 404 |
| `PATCH /tasks/:id/progress` | Như trên | `{ status, workResult? }`, own CAS, invalid transition 409 |
| `POST /service-orders` | C | `{ bookingId, serviceId, quantity, requestedTime?, notes?, requestId? }` |
| `GET /service-orders/me` | C | Own list; `reviewStatus, executionStatus, keyword, page, limit` |
| `GET /service-orders/order-contexts` | C | Own active CHECKED_IN Booking choices tối thiểu |
| `GET /service-orders/catalog` | C | Active Service choices, server unitPriceVND |
| `GET /service-orders/:id` | C | Own order + current Booking ownership; không audit nội bộ |
| `GET /service-orders/requests` | R | Staff list, cùng nhóm filters/paging |
| `GET /service-orders/requests/:id` | R | Review/billing/assignment context authoritative |
| `PATCH /service-orders/:id/review` | R | `{ decision: 'ACCEPT' \| 'REJECT', reason? }`; reject cần reason |
| `GET /service-orders/:id/assignees` | R | Active S khi order eligible |
| `POST /service-orders/:id/assignment` | R | `{ assigneeId, dueAt? }`; ACCEPTED + confirmed ledger nếu paid |
| `GET /service-orders/history/me` | S | Own completed/finalized; `keyword, from, to, page, limit` |
| `GET /service-orders/history/:id` | S | `:id` là **orderId**, không taskId; own history detail |
| `POST /issues` | C | `{ title, category, description, bookingId, roomId? }` theo context/ownership thật |
| `GET /issues` | C/R/M | Role-scoped list; `keyword, status, category, priority, page, limit` |
| `GET /issues/:id` | C/R/M | Customer own safe DTO; staff context/linked Task summaries |
| `PATCH /issues/:id/review` | R | `{ handlingCategory, priority, needsStaffAction, notes? }` |
| `GET /issues/:id/assignees` | R | Active staff đúng SERVICE/OPERATIONS category |
| `POST /issues/:id/assignment` | R | `{ assigneeId, dueAt? }`; durable intent, H8 Task |
| `POST /issues/:id/close` | R/M | `{ conclusion }` trim 1–2000; close gate phía server |
| `GET /issues/service-tasks/:taskId/context` | S | Own IN_PROGRESS canonical Service Task và chain thật |
| `POST /issues/service-tasks/:taskId` | S | `{ title, category, description, requestId? }`; receipt Issue mới |

Sources: `backend/src/modules/tasks/tasks.controller.ts:29`, `backend/src/modules/service-orders/service-orders.controller.ts:24`, `backend/src/modules/issues/issues.controller.ts:24`, `backend/src/modules/issues/service-task-issues.controller.ts:10`. Không có endpoint dashboard hoặc HTTP Task create/reassign/delete trong phạm vi này.

### 2.4 Frontend routes và UX

| Route | Role / chức năng |
|---|---|
| `/staff/tasks`, `/staff/tasks/:id` | S/O hoặc `task:execute`; own list/detail/progress, UC34 form nằm trong own Task detail |
| `/staff/service/dashboard` | S; summary/count/list Task thật |
| `/staff/operations/dashboard` | O; summary/count/list Task thật |
| `/customer/service-orders/new` | C; Booking/catalog choices thật, estimate không phải receipt |
| `/customer/service-orders`, `/customer/service-orders/:id` | C; own list/detail |
| `/staff/service-orders`, `/staff/service-orders/:id` | R; review/billing/assignment |
| `/staff/service-history`, `/staff/service-history/:id` | S; own completed history, detail bằng orderId |
| `/customer/issues/report`, `/customer/issues`, `/customer/issues/:id` | C; report và own list/detail |
| `/staff/issues`, `/staff/issues/:id` | R; review/assign/close |
| `/manager/issues`, `/manager/issues/:id` | M; list/detail/authorized close |

Sources: `frontend/src/features/tasks/routes.tsx:6`, `frontend/src/features/staff-dashboards/routes.tsx:6`, `frontend/src/features/service-orders/routes.tsx:12`, `frontend/src/features/issues/routes.tsx:8` và `presentation.tsx`.

- Shared API client/TanStack Query, auth-scoped cache, loading/empty/error/reload và pending controls; mutation không optimistic accept/assignment. Không thêm production mock path.
- History link về own Task dùng taskId; không link S vào Receptionist order/Issue pages. History read-only, workResult chỉ own history/Task, không lộ sang Customer hoặc staff request summary.
- **Defect đã sửa:** History keyword input trước maxLength 200 trong khi API cap 100; owned FE file đã đổi về 100 và có regression test. Không sửa shared filter của Dương.
- Invalidation chỉ trong QueryClient/session hiện tại; session khác cần refetch/reload/focus. Không claim realtime nhiều người dùng hoặc tự invalidate mọi dashboard.

## 3. Bàn giao và việc đang chờ

| Owner | Phạm vi còn lại / quyết định cần có | Tác động |
|---|---|---|
| Khoa | H10 role layout/navigation, thay menu/layout tạm theo contract chung | H10 pending; không chặn backend A/B/C đang hoạt động |
| Lâm | Maintenance schema/collection `maintenances`, caller persisted source, scope/eligibility và OPERATIONS_STAFF policy | **BLOCKED riêng integration Maintenance** trong H8/core; không đánh dấu mọi Task blocked |
| Hiếu | Booking seed dùng ngày cố định/chọn active Room tùy ý cần revisit; chốt booking/pricing/context policy | Fixtures E2E không thay demo data; không sửa shared seed trong lượt này |
| Dương | Phê duyệt custom-role vs exact-role workflows; review query/URL echo và privacy của shared exception/log filter | Không tự mở rộng quyền hoặc tuyên bố log hoàn toàn sạch |
| Vũ | Authenticated A/B/C browser QA, responsive/keyboard/error/recovery acceptance; parent final checks/CI trên final head | Mọi task vẫn PARTIAL cho đến có evidence và approval |

Task/Issue/ServiceOrder **chưa có business seeds**; deferred đến khi đủ User/Booking/Room/source contexts hợp lệ. Seed tests hiện có chỉ chạy trên disposable DB; không chạy seed/ghi shared DB hoặc dựng fake IDs để demo. Contract Maintenance phải import TasksModule một chiều và gọi service sau authorization/source validation, không clone core.

## 4. Lưu ý khi sửa code liên quan

### 4.1 Service Order: snapshot, billing và recovery

- Create dùng quantity JSON integer dương an toàn; snapshot name/unit/unitPriceVND/amount từ Service thật, tích VND phải safe integer. Notes tối đa 2000; requestedTime optional ISO, bỏ trống dùng giờ server; không tự thêm rule tương lai/trong kỳ lưu trú chưa được duyệt.
- ReviewStatus hiện hữu: **PENDING_REVIEW / ACCEPTING / ACCEPTED / REJECTED**. ExecutionStatus: **NOT_STARTED / ASSIGNING / ASSIGNED / IN_PROGRESS / COMPLETED**. ACCEPTING không phải accepted; ASSIGNING không phải finalized Task link.
- Review CAS persist decision/reason/actor/time trước billing. Paid ACCEPT chỉ finalize khi Invoice active/đúng Booking, đúng **một** charge sourceId = orderId, SERVICE, amount snapshot, reason `Service order <id>`, approved true. Free/zero/reject không tạo charge/Invoice chỉ để ghi dòng 0.
- Same review intent retry giữ audit đầu tiên, reconcile charge đã persist; khác intent 409. Nếu charge đúng đã tồn tại, có thể finalize sau checkout theo H7 active/association gate; không tạo charge mới sau khi Booking mất eligibility.
- Assignment yêu cầu ACCEPTED và paid ledger đã xác nhận; không gọi addCharge/getOrCreate, không thay giá hoặc payment. CAS NOT_STARTED → ASSIGNING lưu assignee/dueAt/title/request time/deterministic Task ID, rồi create/reconcile và finalize link.
- ASSIGNING chỉ retry cùng assignee + cùng dueAt instant/omitted; reconcile cả Task đã COMPLETED. Finalized assignment replay 409 → reload. Partial intent không được tự đổi người hoặc sinh identity mới.
- Task là authoritative progress; Service Order execution là **eventual projection**. Sau Task commit, projection lỗi chỉ warn, không fake rollback Task; list/detail/history đọc Task và guarded CAS repair, không lùi completed. Read repair có thể ghi projection và vẫn có thể lỗi khi DB chưa phục hồi.

### 4.2 Issue review/assignment/closure và UC34

- IssueStatus hiện hữu: **PENDING_REVIEW / REVIEWED / ASSIGNING / ASSIGNED / CONCLUDED / CLOSED**; priority LOW/NORMAL/HIGH/URGENT; handlingCategory SERVICE/OPERATIONS. Customer DTO không lộ review/closure audit nội bộ hoặc raw User/Booking/Task.
- Receptionist review xác định needsStaffAction/category/priority; cần action thì assign active staff đúng category qua durable intent + deterministic Task identity. Không cần action thì CONCLUDED và không tạo Task; caller close phải có conclusion hợp lệ.
- Close do R/M gọi riêng, chỉ khi no-action conclusion hợp lệ hoặc linked resolution work đủ điều kiện completed. **Task COMPLETED không tự close Issue**; close không sửa Task, không cho worker/customer close.
- UC34 yêu cầu active S sở hữu Task IN_PROGRESS, source SERVICE_ORDER + canonical type; Order ACCEPTED và linkedTask khớp; Service tồn tại; Booking active/đúng order và customer khớp. Existing chain vẫn cho Service inactive hoặc Booking CHECKED_OUT; không dùng catalog/create-order gate sai chỗ.
- Server derive reporter/source refs/NORMAL/PENDING_REVIEW; title/category/description trim bắt buộc, giới hạn 200/100/5000. Không nhận client source IDs/reporter/status/priority/room. `sourceTask` là Task dịch vụ gốc, **khác linkedTask** xử lý Issue sau review.
- Report chỉ tạo Issue/receipt; không sửa Task/Order/ledger/assignment/close. S vẫn không có quyền general Issue list/detail; receipt không mở deep link trái quyền.

### 4.3 Idempotency và partial failure: không fake atomic

- Create order unique `(customer, requestId)`; UC34 unique `(reporter, requestId)`, partial index khi UUID string; normalized fingerprint để cùng key/cùng payload trả receipt cũ, khác payload 409. Không key thì repeat nội dung là hợp lệ. Replay vẫn kiểm tra ownership/source eligibility; UC34 existing-key replay có thể sau Task completion khi chain còn hợp lệ, GET context vẫn cần IN_PROGRESS.
- FE requestId chỉ giữ trong memory theo payload; reload/remount mất key. Không hứa exactly-once qua reload; xem list trước khi gửi lại nếu kết quả mạng không rõ. Explicit new report tạo key mới.
- CAS/index/guarded locks bảo vệ từng bước và work identity, **không có transaction atomic xuyên User/Booking/Order/Invoice/Task/Issue**. Có TOCTOU giữa đọc nguồn và insert; unique key không khóa bất biến nguồn.
- Recovery request-driven, không background rollback/job. Lỗi non-HTTP review/assignment có thể trả 503 và giữ durable intent; 409/invalid ledger/inactive assignee/incomplete intent có thể cần can thiệp được duyệt. Không raw DB surgery/đổi ledger/intent để ép success; sửa nguồn qua owner, retry cùng intent và xác minh counts/ledger.

## 5. Hạn chế đã biết và bằng chứng QA

### 5.1 Phân loại evidence cuối

Các số liệu agent/parent dưới đây là bàn giao, không phải chạy lại full suite trong lượt chỉ hợp nhất tài liệu.

| Phạm vi | Evidence / kết luận đúng mức |
|---|---|
| Agent BE workflow mới | `backend/test/vu-workflows.e2e-spec.ts`: **8 tests**, real AppModule, không override dependency: A×1, B×4, C×1, recovery×1, security×1 |
| Agent BE full E2E | **324 tests / 32 files PASS**, hai lượt trên hai fresh disposable containers; không dùng shared DB |
| Sau final enum adjustment | Targeted workflow **8 PASS**; **chưa chạy full E2E lại sau enum**, không gọi full 324 là final-post-enum PASS |
| Agent BE unit | **850 tests / 36 files PASS** |
| Agent FE | **392 tests / 26 files PASS**, gồm regression History keyword 100 (trước 200) trong owned file |
| Production typecheck | PASS theo bàn giao; `npm run typecheck` backend dùng tsconfig.build, không bao gồm mọi test |
| Test-inclusive TypeScript | `npx tsc --noEmit` còn FAIL baseline auth/invoice/H5 enum test types; không có lỗi ở test workflow mới; không gọi toàn repo TS sạch |
| Lượt hợp nhất tài liệu | Đã chạy riêng `npm run lint` và `npm run typecheck` ở backend/frontend: cả bốn PASS; không chạy lại format/build/unit/E2E hoặc test-inclusive TS |
| Final local BE | format/lint/typecheck/build PASS; 850 tests / 36 files PASS |
| Final local FE | format/lint/typecheck/build PASS; 392 tests / 26 files PASS; bundle 713.11 kB warning |
| Final post-enum full E2E | **323/324**, 31/32 files PASS; H5 seed isolation FAIL, Vu workflows 8/8 PASS |
| Baseline isolation diagnosis | Không chạy suite Vũ: seed suite PASS nhưng để lại booking mẫu; chạy H5 sau đó tái hiện expected0/actual1 tại test/h5-schemas.e2e-spec.ts:142. Full exclude Vu 316/316 PASS khi H5 chạy trước. Lỗi thứ tự suite có sẵn, không coi rerun pass là đã sửa |
| Final PR/CI/review | Commit `4cfbab6` đã push; draft PR #34: https://github.com/duongvn9/hotel-mangagement-system/pull/34. Run `40118700775` đúng head này PASS backend (gồm E2E), frontend, Docker. Chưa review/merge; CI pass không xóa lỗi seed/H5 order-dependent đã tái hiện local |
| Compose smoke | Chưa chạy/chưa có evidence availability; không claim PASS |

Workflow test thật kiểm tra persist/charge/Task counts, own/foreign scope, concurrent create/review/assign/report, completion và explicit close. Recovery tạo **real pricing failure** bằng broken Room→RoomType ref trong fixture rồi phục hồi, thấy ACCEPTING và retry chỉ một charge; không mock InvoicesService để giả workflow success. Security gồm 401, exact-role 403, IDOR 404, malformed IDs, inactive catalog/Booking/User; mã lỗi phụ thuộc route (ví dụ malformed order 400, Issue/Task 404; inactive progress 400, UC34 403), không gộp mọi lỗi thành một status.

### 5.2 Browser thực tế — không mock, chưa authenticated

- Chrome thật qua CDP, không mock network/data: **24 anonymous route visits = 8 routes × 1440/768/375px**, đều redirect `/login`, không horizontal overflow trên trang login. Đây không phải 24 protected pages được render hoặc acceptance workflow.
- Đã kiểm tra login API error states và Tab focus vào brand link, có screenshot verification; không suy thành full keyboard/a11y pass (computed outline `none` không phải bằng chứng focus ring đầy đủ).
- Evidence local: `C:\Users\MYPC~1\AppData\Local\Temp\opencode\vu-final-qa\results.json` và `anonymous-login-1440.png`, `anonymous-login-768.png`, `anonymous-login-375.png`. Không đưa profile/token/credential vào tài liệu hoặc repo.
- **Authenticated browser A/B/C chưa làm**: role UI, form pending/reload, multiuser refresh, responsive protected screens, focus/errors và recovery còn phải nghiệm thu.
- E2E dùng dev auth middleware với persisted User thật, không phải bằng chứng live Firebase credentials/token verification. Dev headers chỉ ngoài production; không ghi secret values. Shared exception/log filter có giới hạn URL/query echo cần Dương review, không claim đã fix privacy toàn hệ thống.

## 6. Kiểm tra nhanh và final acceptance

### 6.1 Môi trường / lệnh

Chạy từ đúng thư mục backend/frontend. Không trỏ test/seed vào shared DB; chỉ dùng disposable test database theo `backend/test/test-database.ts`. Firebase/dev config lấy từ hướng dẫn chung, không copy credential vào doc. Lượt tài liệu này không chạy container/seed/Compose/full tests.

| Thư mục | Lệnh kiểm tra |
|---|---|
| backend | `npm run lint`; `npm run typecheck`; `npm run format:check`; `npm test`; `npm run build` |
| backend, Mongo cô lập | `npm run test:e2e`; targeted: `npm run test:e2e -- test/vu-workflows.e2e-spec.ts` |
| backend, test-inclusive diagnostic | `npx tsc --noEmit` — baseline failures như mục 5, không thay production typecheck |
| frontend | `npm run lint`; `npm run typecheck`; `npm run format:check`; `npm test`; `npm run build` |

### 6.2 Quick QA theo role — cùng bộ fixtures persist thật

Dùng fixture setup trong `backend/test/vu-workflows.e2e-spec.ts:38` và `:288` trở đi làm chuẩn cho disposable QA environment; lấy ID do setup/API trả về, **không copy ID bịa**. Cùng bộ Customer, Customer outsider, Receptionist, Manager, service worker/coworker, Operations, Booking CHECKED_IN, Room→RoomType và billable Service. Fixture hiện dùng quantity 2, amount 100000, roomTotal 600000; các số này là input/assertion test, không phải pricing policy môi trường chung. Browser cần account/data tương ứng được provision hợp lệ, không giả gọi fixture đang sẵn trên shared DB.

| Luồng | Thao tác và acceptance cần ghi nhận |
|---|---|
| **A — Service Order** | C chọn own Booking/Service, tạo quantity 2; cùng key race chỉ một order, chưa có Task. R accept → một approved charge đúng source/amount; replay không thêm phí. R assign S → một linked Task. S own dashboard/detail → IN_PROGRESS → COMPLETED có result; history chỉ own finalized completed. Coworker/outsider không đọc được; assignment/completion không đổi ledger. |
| **B — Customer Issue** | C report `{ title, category, description, bookingId, roomId }` từ own context; R review `{ handlingCategory: 'SERVICE' hoặc 'OPERATIONS', priority: 'NORMAL', needsStaffAction: true }`, assign đúng S/O. Worker hoàn thành qua HTTP; Issue vẫn ASSIGNED. R/M close `{ conclusion: 'Đã xác minh xử lý' }`; worker/C bị 403, close sớm hoặc lặp 409. Nhánh needsStaffAction false → CONCLUDED → close, không Task; thử cả R/M. |
| **C — UC34** | Từ A ở IN_PROGRESS, S mở report context thật; gửi title/category/description + UUID. Issue PENDING_REVIEW giữ sourceTask/Order/Booking/Service, retry cùng key một Issue. R review/assign coworker xử lý Task **khác**; coworker complete rồi M/R close. Task dịch vụ gốc, Order và ledger không đổi; foreign staff 404, không mở general Issue page cho S. |
| **Recovery / negative** | Broken pricing source chỉ trong disposable fixture → ACCEPTING, sửa qua owner/fixture setup rồi retry cùng review → đúng một charge. Reload ASSIGNING giữ persisted assignee/dueAt; assignee inactive hoặc intent thiếu không đổi người lén, chuyển owner xử lý. Partial charge/finalize và Task persist/finalize phải reconcile đúng identity; Issue closing vẫn gate completed/no-action, không dùng DB writes để ép trạng thái. |

### 6.3 Điều kiện kết thúc

- [ ] Vũ ghi authenticated browser evidence A/B/C trên desktop/768/375px, keyboard/focus/errors/pending/reload và own/foreign role cases; không dùng anonymous login screenshots thay thế.
- [ ] Lâm chốt Maintenance contract; Khoa bàn giao H10; Hiếu xác nhận seed/pricing/context policy; Dương phê duyệt RBAC/custom-role và review shared log privacy theo phạm vi của từng owner.
- [x] Đã chạy final local lint/typecheck/format/build/unit và full post-enum E2E; kết quả FAIL baseline isolation được ghi riêng, không claim final full PASS.
- [ ] Hiếu/Dương xử lý seed/H5 shared-test-database isolation: seed.e2e-spec.ts gọi runSeeds nhưng không dọn fixtures; H5 giả định sample booking chưa tồn tại. Không thay đổi shared tests trong PR Vũ.
- [ ] Có final PR/CI/review evidence thật; không đặt SHA giả, không empty commit để tạo bằng chứng. Chỉ nâng task sang DONE khi đủ acceptance và owner approval; dependency chưa xong chỉ block phạm vi liên quan.
