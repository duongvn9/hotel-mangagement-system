import { randomUUID, createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { isUUID, validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { EquipmentService } from '../equipment/equipment.service.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { TasksService } from '../tasks/tasks.service.js';
import { TaskSourceType } from '../tasks/task-contract.js';
import { Maintenance } from './schemas/maintenance.schema.js';
import {
  ReportFaultDto,
  type MaintenanceTargetsQuery,
  type ReportReceipt,
} from './dto/report-fault.dto.js';

export const MAINTENANCE_TASK_TYPE = 'MAINTENANCE';
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private index?: Promise<unknown>;
  constructor(
    @InjectModel(Maintenance.name) private readonly reports: Model<Maintenance>,
    @InjectModel(Room.name) private readonly rooms: Model<Room>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly equipment: EquipmentService,
    private readonly tasks: TasksService,
  ) {}

  async targets(query: MaintenanceTargetsQuery) {
    const q = query.q ?? '';
    const literal = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [rooms, equipment] = await Promise.all([
      this.rooms
        .find({
          isActive: true,
          roomNumber: { $regex: literal, $options: 'i' },
        })
        .select('roomNumber floor status')
        .sort({ roomNumber: 1, _id: 1 })
        .limit(20)
        .lean()
        .exec(),
      this.equipment.targets(q),
    ]);
    return {
      rooms: rooms.map((r) => ({
        id: String(r._id),
        roomNumber: r.roomNumber,
        floor: r.floor,
        status: r.status,
      })),
      equipment,
    };
  }
  private async input(value: ReportFaultDto): Promise<ReportFaultDto> {
    const dto = plainToInstance(ReportFaultDto, value);
    if (
      !dto ||
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
        .length
    )
      throw new BadRequestException('Thông tin báo hỏng chưa hợp lệ');
    if (!dto.roomId && !dto.equipmentId && !dto.facilityLocation)
      throw new BadRequestException(
        'Chọn phòng, thiết bị hoặc nhập vị trí cơ sở',
      );
    if (dto.preventsSafeUse && !dto.requiresAction)
      throw new BadRequestException(
        'Lỗi ngăn dùng phòng an toàn phải có hành động xử lý',
      );
    return dto;
  }
  private async context(dto: ReportFaultDto) {
    const equipment = dto.equipmentId
      ? await this.equipment.findActive(dto.equipmentId)
      : null;
    if (dto.equipmentId && !equipment)
      throw new BadRequestException(
        'Thiết bị không tồn tại hoặc đã ngừng sử dụng',
      );
    if (
      dto.roomId &&
      equipment?.room &&
      String(equipment.room) !== dto.roomId.toLowerCase()
    )
      throw new BadRequestException(
        'Thiết bị thuộc phòng khác với phòng đã chọn',
      );
    const roomId =
      dto.roomId ?? (equipment?.room ? String(equipment.room) : undefined);
    const room = roomId
      ? await this.rooms.findOne({ _id: roomId, isActive: true }).lean().exec()
      : null;
    if (roomId && !room)
      throw new BadRequestException(
        'Phòng không tồn tại hoặc đã ngừng sử dụng',
      );
    if (dto.preventsSafeUse && !room)
      throw new BadRequestException(
        'Cần xác định phòng bị ảnh hưởng khi ngăn dùng an toàn',
      );
    return { room, equipment };
  }
  async report(
    value: ReportFaultDto,
    actor: AuthUser,
    key: string = randomUUID(),
  ): Promise<ReportReceipt> {
    if (actor.role !== Role.OperationsStaff || !/^[a-f\d]{24}$/i.test(actor.id))
      throw new ForbiddenException('Chỉ nhân viên vận hành được báo hỏng');
    const user = await this.users
      .findOne({ _id: actor.id, isActive: true, role: Role.OperationsStaff })
      .lean()
      .exec();
    if (!user)
      throw new ForbiddenException('Tài khoản vận hành không còn hoạt động');
    const dto = await this.input(value);
    if (typeof key !== 'string' || !isUUID(key))
      throw new BadRequestException('Idempotency-Key phải là UUID hợp lệ');
    const normalized = {
      roomId: dto.roomId?.toLowerCase(),
      equipmentId: dto.equipmentId?.toLowerCase(),
      facilityLocation: dto.facilityLocation,
      description: dto.description,
      requiresAction: dto.requiresAction,
      preventsSafeUse: dto.preventsSafeUse,
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
    const scope = { reportedBy: new Types.ObjectId(actor.id), requestKey: key };
    let report = await this.reports.findOne(scope).exec();
    if (report && report.requestFingerprint !== fingerprint)
      throw new ConflictException('Khóa gửi lại đã dùng cho nội dung khác');
    if (report?.receipt) return this.receipt(report);
    try {
      const context = await this.context(dto); // Validate all targets before the first business write.
      if (
        report &&
        String(report.room ?? '') !== String(context.room?._id ?? '')
      )
        throw new ConflictException(
          'Vị trí thiết bị đã thay đổi; cần kiểm tra báo cáo đã lưu',
        );
      if (!report) {
        this.index ??= this.reports.collection.createIndex(
          { reportedBy: 1, requestKey: 1 },
          { unique: true, name: 'unique_maintenance_request' },
        );
        await this.index;
        try {
          report = await this.reports
            .findOneAndUpdate(
              scope,
              {
                $setOnInsert: {
                  ...scope,
                  requestFingerprint: fingerprint,
                  description: dto.description,
                  ...(context.room ? { room: context.room._id } : {}),
                  ...(context.equipment
                    ? { equipment: context.equipment._id }
                    : {}),
                  ...(dto.facilityLocation
                    ? { facilityLocation: dto.facilityLocation }
                    : {}),
                  requiresAction: dto.requiresAction,
                  preventsSafeUse: dto.preventsSafeUse,
                  ...(dto.requiresAction
                    ? { taskIdentity: new Types.ObjectId() }
                    : {}),
                },
              },
              { upsert: true, returnDocument: 'after', runValidators: true },
            )
            .exec();
        } catch (error) {
          if ((error as { code?: number })?.code !== 11000) throw error;
          report = await this.reports.findOne(scope).exec();
        }
        if (!report) throw new Error('Maintenance record was not persisted');
        if (report.requestFingerprint !== fingerprint)
          throw new ConflictException('Khóa gửi lại đã dùng cho nội dung khác');
        if (report.receipt) return this.receipt(report);
      }
      if (report.requiresAction) {
        const identity = report.taskIdentity!;
        const taskInput = {
          title: `Bảo trì: ${report.description.slice(0, 180)}`,
          taskType: MAINTENANCE_TASK_TYPE,
          priority: report.preventsSafeUse ? 'URGENT' : 'NORMAL',
          sourceType: TaskSourceType.Maintenance,
          sourceId: String(report._id),
          assigneeId: actor.id,
        };
        const find = async () => {
          try {
            return await this.tasks.findAssigned(actor.id, String(identity));
          } catch (error) {
            if (error instanceof NotFoundException) return null;
            throw error;
          }
        };
        let task = await find();
        if (!task) {
          try {
            await this.tasks.create(taskInput, identity);
          } catch (error) {
            task = await find();
            if (!task) throw error;
          }
          task ??= await find();
        }
        if (
          !task ||
          task.sourceType !== TaskSourceType.Maintenance ||
          task.sourceId !== String(report._id) ||
          task.taskType !== MAINTENANCE_TASK_TYPE ||
          task.priority !== taskInput.priority
        )
          throw new Error('Task does not match maintenance intent');
        await this.reports.updateOne(
          { _id: report._id },
          { $set: { task: identity } },
        );
        report.task = identity;
      }
      if (report.equipment)
        await this.equipment.markFaulty(String(report.equipment));
      const result =
        report.preventsSafeUse && report.room
          ? await this.markRoomUnavailable(String(report.room))
          : { roomMarkedUnavailable: false, warnings: [] };
      await this.reports.updateOne(
        { _id: report._id, receipt: { $exists: false } },
        { $set: { receipt: result } },
      );
      // Concurrent callers return the first persisted receipt, never overwrite it.
      const stored = await this.reports.findById(report._id).exec();
      if (!stored?.receipt)
        throw new Error('Maintenance receipt not persisted');
      return this.receipt(stored);
    } catch (error) {
      if (
        !report ||
        (error instanceof ConflictException &&
          report.requestFingerprint !== fingerprint)
      )
        throw error;
      this.logger.error({
        event: 'maintenance_report_incomplete',
        reportId: String(report._id),
      });
      throw new ServiceUnavailableException(
        `Báo cáo ${report._id} đã được lưu nhưng chưa hoàn tất. Giữ nguyên nội dung và gửi lại để tiếp tục an toàn.`,
      );
    }
  }
  private receipt(
    report: Maintenance & { _id: Types.ObjectId },
  ): ReportReceipt {
    return {
      reportId: String(report._id),
      ...(report.task ? { taskId: String(report.task) } : {}),
      roomMarkedUnavailable: report.receipt!.roomMarkedUnavailable,
      warnings: report.receipt!.warnings,
    };
  }
  private async markRoomUnavailable(id: string) {
    const updated = await this.rooms
      .findOneAndUpdate(
        {
          _id: id,
          isActive: true,
          status: { $in: [RoomStatus.Available, RoomStatus.Cleaning] },
        },
        { $set: { status: RoomStatus.Maintenance } },
        { returnDocument: 'after', runValidators: true },
      )
      .lean()
      .exec();
    if (updated) return { roomMarkedUnavailable: true, warnings: [] };
    const current = await this.rooms
      .findOne({ _id: id, isActive: true })
      .lean()
      .exec();
    if (current?.status === RoomStatus.Maintenance)
      return { roomMarkedUnavailable: true, warnings: [] };
    if (current?.status === RoomStatus.Occupied)
      return {
        roomMarkedUnavailable: false,
        warnings: ['Phòng đang có khách; cần lễ tân xử lý'],
      };
    throw new ConflictException('Phòng vừa thay đổi; vui lòng gửi lại báo cáo');
  }
}
