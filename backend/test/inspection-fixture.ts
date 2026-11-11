import { Types, type Model } from 'mongoose';
import { Task } from '../src/modules/tasks/schemas/task.schema.js';
import {
  TaskSourceType,
  TaskStatus,
} from '../src/modules/tasks/task-contract.js';

/**
 * Lần kiểm tra phòng khi trả phòng của một booking (task CHECKOUT_INSPECTION); mặc định đã được
 * nhân viên dịch vụ hoàn thành, là điều kiện để lễ tân trả phòng.
 */
export function addInspection(
  tasks: Model<Task>,
  bookingId: unknown,
  status: TaskStatus = TaskStatus.Completed,
) {
  return tasks.create({
    title: 'Kiểm tra phòng khi trả phòng (test)',
    taskType: 'CHECKOUT_INSPECTION',
    priority: 'HIGH',
    status,
    assignedTo: new Types.ObjectId(),
    sourceType: TaskSourceType.CheckoutInspection,
    sourceId: new Types.ObjectId(String(bookingId)),
    ...(status === TaskStatus.Completed
      ? { completedAt: new Date(), workResult: 'Phòng ổn' }
      : {}),
  });
}
