export const SERVICE_ORDER_EXECUTION_TASK_TYPE = 'SERVICE_ORDER_EXECUTION';

export enum TaskStatus {
  Assigned = 'ASSIGNED',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
}

export enum TaskSourceType {
  ServiceOrder = 'SERVICE_ORDER',
  Issue = 'ISSUE',
  Maintenance = 'MAINTENANCE',
}

export function canTransitionTaskStatus(from: unknown, to: unknown): boolean {
  return (
    (from === TaskStatus.Assigned && to === TaskStatus.InProgress) ||
    (from === TaskStatus.InProgress && to === TaskStatus.Completed)
  );
}
