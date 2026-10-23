# Tiến độ phần việc của Vũ

## Đọc nhanh

- H8/#64 đã viết contract backend trên `feature/H8-task-contract`, chưa xác nhận QA do thiếu dependency cục bộ; chưa commit/merge.
- Chỉ có schema, DTO, service tạo Task và hàm chuyển trạng thái thuần. Không có controller, UI hoặc endpoint cập nhật trạng thái.
- Đã đọc UC37/38, BR-TASK-03/05 và ERD ngoài repo trong thư mục `WDP301/docs`.
- **Không đổi contract H8 nếu chưa thông báo nhóm**, đặc biệt Lâm dùng cho UC35/UC55 và các nguồn Service Order/Issue/Maintenance.

## 1. Trạng thái task

| # | Task | Trạng thái | Commit/PR |
|---|---|---|---|
| H8 | Contract Task dùng chung | Đã viết, chờ QA/review | Branch `feature/H8-task-contract`; chờ commit/PR |
| 64 | Task core, lifecycle, source reference | Đã viết trong phạm vi H8; chưa xác nhận QA | Branch `feature/H8-task-contract`; chờ commit/PR |
| 65 | Staff / Operations Dashboard | Chưa làm | Chưa có |
| 66 | UC37 View Assigned Tasks | Chưa làm | Chưa có |
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
- Index: `{ assignedTo: 1, status: 1 }`, `{ status: 1 }`, `{ sourceType: 1, sourceId: 1 }`; không unique nguồn vì một nguồn có thể có nhiều task.
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

- Assignee phải tồn tại và `isActive === true`. Chấp nhận SERVICE_STAFF / OPERATIONS_STAFF theo UC37/38; role khác chỉ được nhận việc nếu Role đang active có permission **đã tồn tại** `task:execute`, theo cơ chế của Dương. Không tự thêm permission hoặc phân quyền riêng theo loại nguồn khi SRS chưa quy định.
- Service nội bộ không xác thực người tạo task. Caller tương lai chịu trách nhiệm quyền tạo/giao việc và scope nguồn; `AuthUser.id` là User ID, không dùng Firebase UID làm assigneeId.
- Validation hình dạng ID **khác** kiểm tra tồn tại: sau validation, service query DB thật bằng injected Connection với `_id` và projection `_id`.
- Mapping collection explicit trong `TASK_SOURCE_COLLECTIONS`: SERVICE_ORDER → `serviceorders`, ISSUE → `issues`, MAINTENANCE → `maintenances`. Đây là giả định tích hợp cần chủ module nguồn xác nhận trước khi dùng; schema nguồn hiện chưa tồn tại. Không nhận tên collection từ caller. Nguồn/collection không tồn tại → từ chối tạo; lỗi DB truyền ra, không persist giả.
- Không kiểm tra trạng thái duyệt/quyền xem/soft-delete của nguồn khi chưa có schema nguồn; caller nghiệp vụ phải bổ sung khi tích hợp. Kiểm tra tồn tại tại thời điểm tạo không thay thế transaction hoặc chính sách cấm xóa nguồn sau này.
- **Hoãn seed Task**: seed hiện có User nhưng chưa có ServiceOrder/Issue/Maintenance hợp lệ. Không thêm seed trỏ ID bịa hoặc sửa seed người khác. Khi có nguồn thật, seed phải theo thứ tự phụ thuộc và gọi cùng validation.
- UC38 sau này phải kiểm tra assignedTo với user hiện tại, cập nhật atomic theo trạng thái cũ, bắt buộc completedAt/workResult khi hoàn thành; Task hoàn thành không đồng nghĩa tự đóng Issue.

## 4. QA và bàn giao

Đã thêm unit test lifecycle toàn bộ 9 cặp enum và giá trị ngoài enum, schema/default/index, Nest injection, DTO và service validation, assignee/permission, mapping và nguồn không tồn tại, persistence/lỗi DB. Model và Connection được mock trong test service; schema validation chạy in-memory. **Không phải** kiểm thử tích hợp MongoDB hay nguồn thật.

Đã chạy từ thư mục `backend` (không cài dependency, không chạy DB):

| Lệnh chính xác | Kết quả |
|---|---|
| `npm run lint` | Không chạy được: `oxlint` not recognized |
| `npm run typecheck` | Không chạy được: `tsc` not recognized |
| `npm test -- src/modules/tasks/tasks.spec.ts` | Không chạy được: `vitest` not recognized |
| `npm run build` | Không chạy được: `nest` not recognized |

Chưa có kết quả pass; cần chạy lại bốn lệnh khi dependency đã sẵn sàng, sau đó `npm test` để kiểm tra regression toàn backend. Chưa chạy e2e vì thiếu dependency và chưa xác minh MongoDB test an toàn. Không cài package trong lần thực hiện này. `git diff --check` đạt trước commit. Commit/PR được cập nhật sau khi tạo thành công; chưa xác nhận merge. Bàn giao contract qua PR cho Lâm/Hiếu/Khoa, chưa xác nhận nhóm đã tiếp nhận.
