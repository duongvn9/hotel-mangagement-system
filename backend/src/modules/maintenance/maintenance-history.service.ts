import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type PipelineStage } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { toBusinessDate } from '../../common/database/conventions.js';
import { Task, TaskStatus } from '../tasks/schemas/task.schema.js';
import { TaskSourceType } from '../tasks/task-contract.js';
import { Maintenance } from './schemas/maintenance.schema.js';
import {
  MaintenanceHistoryQuery,
  type MaintenanceHistoryDetail,
} from './dto/maintenance-history.dto.js';

/** UC36 policy, shared by list/detail. Change here if operational scope is redefined. */
export const maintenanceHistoryScope = (actorId: Types.ObjectId) => ({
  $or: [{ reportedBy: actorId }, { 'taskData.assignedTo': actorId }],
});

/** Calendar dates use the same Vietnam business-day convention as H6. */
export function maintenanceDateRange(
  query: Pick<MaintenanceHistoryQuery, 'from' | 'to'>,
) {
  const boundary = (day: string) => {
    const date = new Date(`${day}T00:00:00.000+07:00`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(date.getTime()) ||
      toBusinessDate(date) !== day
    )
      throw new BadRequestException('Ngày lọc phải hợp lệ theo YYYY-MM-DD');
    return date;
  };
  const from = query.from ? boundary(query.from) : undefined;
  const to = query.to ? boundary(query.to) : undefined;
  if (from && to && from > to)
    throw new BadRequestException('Ngày từ phải trước hoặc bằng ngày đến');
  return {
    ...(from ? { $gte: from } : {}),
    ...(to ? { $lt: new Date(to.getTime() + 86400000) } : {}),
  };
}

@Injectable()
export class MaintenanceHistoryService {
  private readonly logger = new Logger(MaintenanceHistoryService.name);
  constructor(
    @InjectModel(Maintenance.name) private readonly reports: Model<Maintenance>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
  ) {}
  private pipeline(
    actor: AuthUser,
    match: PipelineStage.Match['$match'] = {},
  ): PipelineStage[] {
    if (actor.role !== Role.OperationsStaff || !/^[a-f\d]{24}$/i.test(actor.id))
      throw new ForbiddenException(
        'Chỉ nhân viên vận hành được xem lịch sử bảo trì',
      );
    return [
      { $match: match },
      // Validate the link as well as its id, so corrupt links cannot grant scope.
      {
        $lookup: {
          from: this.tasks.collection.name,
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
      { $match: maintenanceHistoryScope(new Types.ObjectId(actor.id)) },
      {
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
      },
      {
        $lookup: {
          from: 'rooms',
          localField: 'room',
          foreignField: '_id',
          pipeline: [{ $project: { roomNumber: 1, floor: 1 } }],
          as: 'roomRows',
        },
      },
      {
        $lookup: {
          from: 'equipment',
          localField: 'equipment',
          foreignField: '_id',
          pipeline: [
            { $project: { assetCode: 1, name: 1, category: 1, location: 1 } },
          ],
          as: 'equipmentRows',
        },
      },
      {
        $set: {
          roomData: { $arrayElemAt: ['$roomRows', 0] },
          equipmentData: { $arrayElemAt: ['$equipmentRows', 0] },
        },
      },
    ];
  }
  private projection(detail: boolean): PipelineStage.Project {
    const person = (id: string, name: string) => ({
      id: { $toString: id },
      fullName: { $ifNull: [name, 'Không còn tài khoản'] },
    });
    return {
      $project: {
        _id: 0,
        id: { $toString: '$_id' },
        reportedAt: '$createdAt',
        description: 1,
        requiresAction: 1,
        preventsSafeUse: 1,
        status: '$historyStatus',
        completedAt: {
          $cond: [
            { $eq: ['$historyStatus', TaskStatus.Completed] },
            '$taskData.completedAt',
            '$$REMOVE',
          ],
        },
        target: {
          room: {
            $cond: [
              { $ifNull: ['$roomData', false] },
              {
                id: { $toString: '$roomData._id' },
                roomNumber: '$roomData.roomNumber',
                floor: '$roomData.floor',
              },
              null,
            ],
          },
          equipment: {
            $cond: [
              { $ifNull: ['$equipmentData', false] },
              {
                id: { $toString: '$equipmentData._id' },
                assetCode: '$equipmentData.assetCode',
                name: '$equipmentData.name',
                ...(detail
                  ? {
                      category: '$equipmentData.category',
                      location: '$equipmentData.location',
                    }
                  : {}),
              },
              null,
            ],
          },
          facilityLocation: { $ifNull: ['$facilityLocation', null] },
        },
        ...(detail
          ? {
              reportedBy: person('$reportedBy', '$reporterData.fullName'),
              task: {
                $cond: [
                  { $ifNull: ['$taskData', false] },
                  {
                    id: { $toString: '$taskData._id' },
                    title: '$taskData.title',
                    priority: '$taskData.priority',
                    status: '$taskData.status',
                    assignee: person(
                      '$taskData.assignedTo',
                      '$assigneeData.fullName',
                    ),
                    assignedAt: '$taskData.assignedAt',
                    dueAt: '$taskData.dueAt',
                    completedAt: '$taskData.completedAt',
                    workResult: '$taskData.workResult',
                  },
                  null,
                ],
              },
            }
          : {}),
      },
    };
  }
  private warn(
    rows: { id: string; requiresAction: boolean; status: unknown }[],
  ) {
    for (const row of rows)
      if (row.requiresAction && row.status === null)
        this.logger.warn({
          event: 'maintenance_history_missing_task',
          reportId: row.id,
        });
  }
  async list(query: MaintenanceHistoryQuery, actor: AuthUser) {
    const range = maintenanceDateRange(query);
    const stages = this.pipeline(
      actor,
      Object.keys(range).length ? { createdAt: range } : {},
    );
    if (query.status) stages.push({ $match: { historyStatus: query.status } });
    if (query.q) {
      const literal = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      stages.push({
        $match: {
          $or: [
            'description',
            'roomData.roomNumber',
            'equipmentData.assetCode',
            'equipmentData.name',
            'facilityLocation',
          ].map((field) => ({ [field]: { $regex: literal, $options: 'i' } })),
        },
      });
    }
    const direction = query.sort === 'asc' ? 1 : -1;
    stages.push({
      $facet: {
        items: [
          { $sort: { createdAt: direction, _id: direction } },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
          this.projection(false),
        ],
        count: [{ $count: 'total' }],
      },
    });
    const [result] = await this.reports.aggregate(stages).exec();
    const items = result?.items ?? [];
    this.warn(items);
    return {
      items,
      total: result?.count[0]?.total ?? 0,
      page: query.page,
      limit: query.limit,
    };
  }
  async detail(id: string, actor: AuthUser): Promise<MaintenanceHistoryDetail> {
    if (!/^[a-f\d]{24}$/i.test(id))
      throw new BadRequestException('Mã bản ghi bảo trì không hợp lệ');
    const stages = this.pipeline(actor, { _id: new Types.ObjectId(id) });
    for (const [field, as] of [
      ['reportedBy', 'reporterRows'],
      ['taskData.assignedTo', 'assigneeRows'],
    ]) {
      stages.push({
        $lookup: {
          from: 'users',
          localField: field,
          foreignField: '_id',
          pipeline: [{ $project: { fullName: 1 } }],
          as,
        },
      });
    }
    stages.push({
      $set: {
        reporterData: { $arrayElemAt: ['$reporterRows', 0] },
        assigneeData: { $arrayElemAt: ['$assigneeRows', 0] },
      },
    });
    stages.push(this.projection(true));
    const [row] = await this.reports
      .aggregate<MaintenanceHistoryDetail>(stages)
      .exec();
    if (!row)
      throw new NotFoundException(
        'Không tìm thấy bản ghi hoặc nằm ngoài phạm vi của bạn',
      );
    this.warn([row]);
    return row;
  }
}
