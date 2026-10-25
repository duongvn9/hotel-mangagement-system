import type { PipelineStage } from 'mongoose';
import { TaskStatus, TaskSourceType } from '../tasks/task-contract.js';
/** UC36 authoritative link validation, also used by UC57; no actor scope is widened here. */
export function maintenanceTaskLookup(collection: string): PipelineStage[] {
  return [
    {
      $lookup: {
        from: collection,
        let: { taskId: '$task', reportId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$taskId'] },
                  { $eq: ['$sourceType', TaskSourceType.Maintenance] },
                  { $eq: ['$sourceId', '$$reportId'] },
                ],
              },
            },
          },
          {
            $project: {
              title: 1,
              priority: 1,
              status: 1,
              assignedTo: 1,
              assignedAt: 1,
              dueAt: 1,
              completedAt: 1,
              workResult: 1,
            },
          },
        ],
        as: 'taskRows',
      },
    },
    { $set: { taskData: { $arrayElemAt: ['$taskRows', 0] } } },
  ];
}
export function maintenanceStatusStage(): PipelineStage.Set {
  return {
    $set: {
      historyStatus: {
        $cond: [
          { $eq: ['$requiresAction', false] },
          'NO_ACTION',
          {
            $cond: [
              { $in: ['$taskData.status', Object.values(TaskStatus)] },
              '$taskData.status',
              null,
            ],
          },
        ],
      },
    },
  };
}
