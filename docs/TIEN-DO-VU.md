# Tiến độ phần việc của Vũ

## Đọc nhanh

- H8: **MERGED**, PR #15 tại `c970bf4`; đã kiểm tra local commit này là ancestor của `origin/main`.
- #64: **MERGED**, PR #16 tại merge commit `4046fe0`; đã kiểm tra local commit này là ancestor của `origin/main`. Merge không đồng nghĩa đã xác nhận integration contract nguồn thật.
- PR #16: https://github.com/duongvn9/hotel-mangagement-system/pull/16 — đã merge; các giả định mapping collection và tích hợp nguồn vẫn chưa được giải quyết.
- #66 / PROMPT03 / UC37: **Implemented, pending PR review, không Done**; backend/frontend đã được agents triển khai trên `feature/vu-66-assigned-tasks`. Commit/PR còn pending; dùng tên branch startup người dùng chọn, không dùng tên trailing mâu thuẫn `feature/66-assigned-tasks`.
- Task core có persistence, atomic active-work uniqueness và chuyển trạng thái nội bộ có CAS. UC37 hiện có controller GET và UI chỉ đọc; chưa có task mutation API UC38. Mục 9 là hiện trạng UC37; mục 8 lưu mốc #64 trước merge; mục 4–7 là lịch sử.
- Đã đọc UC37/38, BR-TASK-03/05 và ERD ngoài repo trong thư mục `WDP301/docs`.
- **Không đổi contract H8 nếu chưa thông báo nhóm**, đặc biệt Lâm dùng cho UC35/UC55 và các nguồn Service Order/Issue/Maintenance.

## 9. PROMPT03 — Jira #66 / UC37 View Assigned Tasks (hiện trạng)

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
| 65 | Staff / Operations Dashboard | Chưa làm | Chưa có |
| 66 | UC37 View Assigned Tasks | Implemented, pending PR review (không Done); CI/manual QA pending | `feature/vu-66-assigned-tasks`; commit/PR pending |
| 67 | UC38 Update Task Progress | Chưa làm | Chưa có |
| 68 | UC22 Create Service Order | Chưa làm | Chưa có |
| 69 | UC23 View Service Orders (Customer) | Chưa làm | Chưa có |
| 70 | UC24 View Service Order Requests | Chưa làm | Chưa có |
| 71 | UC25 Review Service Order Request | Chưa làm | Chưa có |
| 72 | UC26 Assign Service Order Task | Chưa làm | Chưa có |
| 73 | UC27 View Service History | Chưa làm | Chưa có |
| 74 | UC28 Report Issue | Chưa làm | Chưa có |
| 75 | UC29 View Issue List | Chưa làm | Chưa có |
| 76 | UC30 Review Issue Request | Chưa làm | Chưa có |
| 77 | UC31 Assign Issue Resolution Task | Chưa làm | Chưa có |
| 78 | UC32 Close Issue | Chưa làm | Chưa có |
| 79 | UC33 View Issue Detail | Chưa làm | Chưa có |
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

- Assignee phải tồn tại và `isActive === true`: SERVICE_ORDER chỉ SERVICE_STAFF (UC26/BR-SER-07), ISSUE nhận SERVICE_STAFF hoặc OPERATIONS_STAFF (UC31/BR-ISS-06), MAINTENANCE chỉ OPERATIONS_STAFF (actor UC35/36). Không suy diễn chuyên môn từ permission `task:execute`; custom roles bị từ chối bảo thủ cho tới khi có policy chuyên môn được thống nhất. ISSUE còn cần caller xác nhận chuyên môn theo tính chất issue/taskType vì chưa có taxonomy/schema nguồn.
- Service nội bộ không xác thực người tạo task. Caller tương lai chịu trách nhiệm quyền tạo/giao việc và scope nguồn; `AuthUser.id` là User ID, không dùng Firebase UID làm assigneeId.
- Validation hình dạng ID **khác** kiểm tra tồn tại: sau validation, service query DB thật bằng injected Connection với `_id` và projection `_id`.
- Mapping collection explicit trong `TASK_SOURCE_COLLECTIONS`: SERVICE_ORDER → `serviceorders`, ISSUE → `issues`, MAINTENANCE → `maintenances`. Đây là giả định tích hợp cần chủ module nguồn xác nhận trước khi dùng; schema nguồn hiện chưa tồn tại. Không nhận tên collection từ caller. Nguồn/collection không tồn tại → từ chối tạo; lỗi DB truyền ra, không persist giả.
- Không kiểm tra trạng thái duyệt/quyền xem/soft-delete của nguồn khi chưa có schema nguồn; caller nghiệp vụ phải bổ sung khi tích hợp. Kiểm tra tồn tại tại thời điểm tạo không thay thế transaction hoặc chính sách cấm xóa nguồn sau này.
- **Hoãn seed Task**: seed hiện có User nhưng chưa có ServiceOrder/Issue/Maintenance hợp lệ. Không thêm seed trỏ ID bịa hoặc sửa seed người khác. Khi có nguồn thật, seed phải theo thứ tự phụ thuộc và gọi cùng validation.
- Core #64 đã có `transitionAssignedTask` kiểm tra assignedTo + trạng thái cũ bằng CAS; UC38 HTTP vẫn chưa làm. Task hoàn thành không đồng nghĩa tự đóng Issue.

## 4. QA và bàn giao (lịch sử H8; xem mục 9 cho UC37)

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
