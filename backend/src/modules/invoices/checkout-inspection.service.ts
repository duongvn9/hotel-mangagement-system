import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../../common/constants/role.enum.js';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema.js';
import { TaskSourceType } from '../tasks/task-contract.js';
import { TasksService } from '../tasks/tasks.service.js';
import { User } from '../users/schemas/user.schema.js';
import type {
  CheckoutInspectionResponse,
  CheckoutInspectionView,
  InspectorListResponse,
  RequestCheckoutInspectionDto,
} from './dto/checkout-inspection.dto.js';

export const CHECKOUT_INSPECTION_TASK_TYPE = 'CHECKOUT_INSPECTION';

const DEFAULT_INSTRUCTIONS =
  'Kiểm tra dịch vụ khách đã dùng và hư hỏng cơ sở vật chất; ghi rõ số lượng và mô tả khi hoàn thành.';

interface InspectionTask {
  _id: unknown;
  status: string;
  assignedTo: unknown;
  assignedAt: Date;
  completedAt?: Date;
  workResult?: string;
}

/**
 * Lễ tân nhờ nhân viên dịch vụ kiểm tra phòng khi khách trả phòng (swimlane check-out): việc được
 * giao qua module Tasks để nhân viên thấy trong danh sách công việc và ghi kết quả khi hoàn thành.
 */
@Injectable()
export class CheckoutInspectionService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly tasks: TasksService,
  ) {}

  async request(
    bookingId: string,
    dto: RequestCheckoutInspectionDto,
  ): Promise<CheckoutInspectionView> {
    const booking = await this.booking(bookingId);
    if (booking.status !== BookingStatus.CheckedIn) {
      throw new ConflictException(
        'An inspection can only be requested for a guest who is checked in',
      );
    }
    const instructions = dto.note
      ? `${DEFAULT_INSTRUCTIONS} Ghi chú của lễ tân: ${dto.note}`
      : DEFAULT_INSTRUCTIONS;
    const task = await this.tasks.create({
      title: `Kiểm tra phòng khi trả phòng ${booking.code}`,
      taskType: CHECKOUT_INSPECTION_TASK_TYPE,
      priority: 'HIGH',
      sourceType: TaskSourceType.CheckoutInspection,
      sourceId: bookingId,
      assigneeId: dto.assigneeId,
      instructions,
    });
    return this.view(task as unknown as InspectionTask);
  }

  /** Lần kiểm tra gần nhất của booking, hoặc null nếu chưa từng yêu cầu. */
  async current(bookingId: string): Promise<CheckoutInspectionResponse> {
    await this.booking(bookingId);
    const task = await this.tasks.latestForSource(
      TaskSourceType.CheckoutInspection,
      bookingId,
    );
    return {
      inspection: task
        ? await this.view(task as unknown as InspectionTask)
        : null,
    };
  }

  /** Nhân viên dịch vụ đang hoạt động để lễ tân chọn người kiểm tra. */
  async inspectors(): Promise<InspectorListResponse> {
    const rows = await this.users
      .find({ isActive: true, role: Role.ServiceStaff })
      .select('_id fullName')
      .sort({ fullName: 1, _id: 1 })
      .lean();
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        fullName: row.fullName,
      })),
    };
  }

  private async view(task: InspectionTask): Promise<CheckoutInspectionView> {
    const assignee = await this.users
      .findById(task.assignedTo)
      .select('fullName')
      .lean();
    return {
      taskId: String(task._id),
      status: task.status,
      assigneeName: assignee?.fullName ?? '',
      requestedAt: task.assignedAt.toISOString(),
      ...(task.completedAt
        ? { completedAt: task.completedAt.toISOString() }
        : {}),
      ...(task.workResult ? { workResult: task.workResult } : {}),
    };
  }

  private async booking(bookingId: string) {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookings.findById(bookingId);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }
}
