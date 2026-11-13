import { createHash } from 'node:crypto';
import { withBookingFinancialOperation } from '../bookings/booking-financial-operation.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema.js';
import { Service } from '../services/schemas/service.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import {
  Invoice,
  type InvoiceDocument,
} from '../invoices/schemas/invoice.schema.js';
import { InvoiceChargeType } from '../invoices/schemas/invoice-charge.schema.js';
import {
  ServiceOrderExecutionStatus,
  ServiceOrderReviewStatus,
} from './service-order-status.js';
import { TasksService } from '../tasks/tasks.service.js';
import {
  SERVICE_ORDER_EXECUTION_TASK_TYPE,
  TaskSourceType,
} from '../tasks/task-contract.js';
import type { Task } from '../tasks/schemas/task.schema.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AssignServiceOrderDto,
  IntakeServiceOrderDto,
  ReassignServiceOrderDto,
  ServiceHistoryQuery,
  CreateServiceOrderDto,
  ListServiceOrdersQuery,
  ReviewServiceOrderDto,
} from './dto/service-order.dto.js';
import {
  ServiceOrder,
  type ServiceOrderDocument,
} from './schemas/service-order.schema.js';

/**
 * Khách đặt được dịch vụ từ khi booking được xác nhận (CONFIRMED) cho tới khi còn ở
 * (CHECKED_IN). Riêng việc nhận/ghi phí dịch vụ (accept) vẫn yêu cầu khách đang ở
 * (CHECKED_IN) để không giao dịch vụ trước khi khách nhận phòng.
 */
const ORDERABLE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.Confirmed,
  BookingStatus.CheckedIn,
];

@Injectable()
export class ServiceOrdersService implements OnModuleInit {
  constructor(
    @InjectModel(ServiceOrder.name)
    private readonly orders: Model<ServiceOrder>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(Service.name) private readonly services: Model<Service>,
    private readonly invoices: InvoicesService,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly tasks: TasksService,
    @InjectModel(Invoice.name) private readonly invoiceRecords: Model<Invoice>,
  ) {}

  async onModuleInit() {
    await this.orders.collection.createIndex(
      { intakeKey: 1 },
      {
        unique: true,
        partialFilterExpression: { intakeKey: { $exists: true } },
      },
    );
    await this.orders.collection.createIndex(
      { customer: 1, requestId: 1 },
      {
        unique: true,
        partialFilterExpression: { requestId: { $exists: true } },
      },
    );
  }

  private intakeActor(user: AuthUser) {
    if (user?.role === Role.Receptionist) return this.receptionist(user);
    this.serviceStaff(user);
    return this.id(user.id);
  }

  private withinStay(time: Date, booking: Booking) {
    return (
      Number.isFinite(time.getTime()) &&
      time >= booking.checkIn &&
      time < booking.checkOut
    );
  }

  private scheduledAcceptance(row: ServiceOrderDocument, booking: Booking) {
    return (
      booking.isActive &&
      (booking.status === BookingStatus.CheckedIn ||
        (booking.status === BookingStatus.Confirmed &&
          row.intakeRole !== Role.ServiceStaff &&
          row.requestedTime > new Date() &&
          this.withinStay(row.requestedTime, booking)))
    );
  }

  async intake(input: IntakeServiceOrderDto, user: AuthUser) {
    const actor = this.intakeActor(user);
    const dto = plainToInstance(IntakeServiceOrderDto, input);
    if (
      !input ||
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
        .length ||
      !dto.requestId
    )
      throw new BadRequestException('Invalid intake input');
    const intakeKey = `service-order-intake:${user.role}:${actor}:${dto.requestId.toLowerCase()}`;
    let row = await this.orders
      .findOne({ intakeKey })
      .select(`+intakeFingerprint ${this.staffSelection}`)
      .exec();
    const booking = await this.ownedBooking(
      this.id(dto.bookingId),
      undefined,
      row ? undefined : 'orderable',
    );
    if (
      !row &&
      user.role === Role.ServiceStaff &&
      booking.status !== BookingStatus.CheckedIn
    )
      throw new ConflictException('Booking must be active and CHECKED_IN');
    if (
      !row &&
      dto.roomId &&
      !booking.rooms.some(
        (room) => String(room) === String(this.id(dto.roomId!)),
      )
    )
      throw new BadRequestException('Room must belong to booking');
    const requestedTime = dto.requestedTime
      ? new Date(dto.requestedTime)
      : undefined;
    if (
      !row &&
      ((requestedTime &&
        (!this.withinStay(requestedTime, booking) ||
          requestedTime <= new Date())) ||
        (booking.status === BookingStatus.Confirmed && !requestedTime))
    )
      throw new BadRequestException(
        'requestedTime must be future and within stay',
      );
    const completed = dto.intakeMode === 'COMPLETED_ON_SITE';
    if (completed) {
      if (
        user.role !== Role.ServiceStaff ||
        !dto.actualPerformerId ||
        !dto.actualCompletedAt ||
        !dto.completionDetails?.trim()
      )
        throw new BadRequestException(
          'Completed report requires performer, actual completion and details',
        );
      const at = new Date(dto.actualCompletedAt);
      if (!this.withinStay(at, booking) || at > new Date())
        throw new BadRequestException(
          'Actual completion must be within stay and not future',
        );
      if (
        !row &&
        !(await this.users
          .findOne({
            _id: this.id(dto.actualPerformerId),
            role: Role.ServiceStaff,
            isActive: true,
          })
          .exec())
      )
        throw new ConflictException(
          'Actual performer must be active ServiceStaff',
        );
    } else if (
      dto.actualPerformerId ||
      dto.actualCompletedAt ||
      dto.completionDetails
    ) {
      throw new BadRequestException(
        'Completion fields require COMPLETED_ON_SITE',
      );
    }
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          bookingId: String(booking._id),
          serviceId: String(this.id(dto.serviceId)),
          quantity: dto.quantity,
          intakeMode: dto.intakeMode,
          roomId: dto.roomId?.toLowerCase() ?? null,
          requesterName: dto.requesterName?.trim() ?? null,
          notes: dto.notes?.trim() || null,
          requestedTime: requestedTime?.toISOString() ?? null,
          actualPerformerId: dto.actualPerformerId?.toLowerCase() ?? null,
          actualCompletedAt: dto.actualCompletedAt
            ? new Date(dto.actualCompletedAt).toISOString()
            : null,
          completionDetails: dto.completionDetails?.trim() ?? null,
        }),
      )
      .digest('hex');
    if (!row) {
      const catalog = await this.services
        .findById(this.id(dto.serviceId))
        .exec();
      if (!catalog || !catalog.isActive)
        throw new ConflictException('Service is not available for ordering');
      const price = catalog.billable === false ? 0 : catalog.price;
      if (
        typeof price !== 'number' ||
        !Number.isSafeInteger(price) ||
        price < 0 ||
        !Number.isSafeInteger(price * dto.quantity)
      )
        throw new BadRequestException('Invalid integer VND amount');
      try {
        row = await this.orders.create({
          booking: booking._id,
          ...(booking.customer ? { customer: booking.customer } : {}),
          service: this.id(dto.serviceId),
          serviceName: catalog.name,
          unit: catalog.unit ?? '',
          quantity: dto.quantity,
          unitPriceVND: price,
          amount: price * dto.quantity,
          requestedTime: requestedTime ?? new Date(),
          notes: dto.notes?.trim() || undefined,
          intakeMode: dto.intakeMode,
          intakeRole: user.role,
          intakeKey,
          intakeFingerprint: fingerprint,
          createdBy: actor,
          reportedBy: actor,
          requesterName: dto.requesterName?.trim(),
          ...(dto.roomId ? { room: this.id(dto.roomId) } : {}),
          ...(completed
            ? {
                actualPerformer: this.id(dto.actualPerformerId!),
                actualCompletedAt: new Date(dto.actualCompletedAt!),
                completionDetails: dto.completionDetails!.trim(),
              }
            : {}),
        });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        row = await this.orders
          .findOne({ intakeKey })
          .select(`+intakeFingerprint ${this.staffSelection}`)
          .exec();
        if (!row) throw error;
      }
    }
    if (row.intakeFingerprint !== fingerprint)
      throw new ConflictException(
        'requestId already used with a different payload',
      );
    if (user.role === Role.Receptionist)
      return this.review(String(row._id), { decision: 'ACCEPT' }, user);
    return this.staffResponse(row);
  }

  private async reconcileIntake(row: ServiceOrderDocument, user: AuthUser) {
    if (row.reviewStatus !== ServiceOrderReviewStatus.Accepted) return;
    if (row.intakeMode === 'COMPLETED_ON_SITE') {
      await this.orders.updateOne(
        {
          _id: row._id,
          reviewStatus: ServiceOrderReviewStatus.Accepted,
          linkedTask: { $exists: false },
        },
        { $set: { executionStatus: ServiceOrderExecutionStatus.Completed } },
      );
      row.executionStatus = ServiceOrderExecutionStatus.Completed;
    } else if (
      row.intakeRole === Role.ServiceStaff &&
      row.reportedBy &&
      [
        ServiceOrderExecutionStatus.NotStarted,
        ServiceOrderExecutionStatus.Assigning,
      ].includes(row.executionStatus)
    ) {
      const eligible = await this.users
        .findOne({
          _id: row.reportedBy,
          role: Role.ServiceStaff,
          isActive: true,
        })
        .exec();
      if (eligible)
        await this.assign(
          String(row._id),
          { assigneeId: String(row.reportedBy) },
          user,
        );
    }
  }

  private customer(user: AuthUser) {
    if (!user) throw new UnauthorizedException();
    if (user.role !== Role.Customer) throw new ForbiddenException();
    if (!Types.ObjectId.isValid(user.id)) throw new UnauthorizedException();
    return new Types.ObjectId(user.id);
  }

  private id(value: string) {
    if (!/^[a-f\d]{24}$/i.test(value))
      throw new BadRequestException('Invalid id');
    return new Types.ObjectId(value);
  }

  /**
   * Lấy booking của chính khách. `require` chọn mức trạng thái cần có:
   *  - 'orderable': đặt dịch vụ, cho phép từ CONFIRMED trở đi (CONFIRMED/CHECKED_IN).
   *  - 'in-house': nhận/ghi phí dịch vụ, chỉ khi khách đang ở (CHECKED_IN).
   * Bỏ trống `require` thì chỉ kiểm tra quyền sở hữu (không ràng buộc trạng thái).
   */
  private async ownedBooking(
    booking: Types.ObjectId,
    customer: Types.ObjectId | undefined,
    require?: 'orderable' | 'in-house',
  ) {
    // Đơn auto-sinh cho khách vãng lai không có customer: lúc đó chỉ định danh theo booking.
    const row = await this.bookings
      .findOne(customer ? { _id: booking, customer } : { _id: booking })
      .exec();
    if (!row) throw new NotFoundException('Booking not found');
    if (require) {
      const allowed =
        row.isActive &&
        (require === 'in-house'
          ? row.status === BookingStatus.CheckedIn
          : ORDERABLE_BOOKING_STATUSES.includes(row.status));
      if (!allowed)
        throw new ConflictException(
          require === 'in-house'
            ? 'Booking must be active and CHECKED_IN'
            : 'Booking must be active and CONFIRMED or CHECKED_IN',
        );
    }
    return row;
  }

  private async executionTask(row: ServiceOrderDocument) {
    if (
      !row.linkedTask ||
      row.reviewStatus !== ServiceOrderReviewStatus.Accepted
    )
      return null;
    const task = await this.tasks.findServiceOrderExecutionWork(
      String(row._id),
      row.linkedTask,
    );
    if (task) {
      await this.tasks.repairServiceOrderExecution(task);
      row.executionStatus =
        task.status as unknown as ServiceOrderExecutionStatus;
    }
    return task;
  }

  private async repairExecutionScope(filter: object) {
    const rows = await this.orders
      .find({ ...filter, linkedTask: { $exists: true } })
      .exec();
    await Promise.all(rows.map((row) => this.executionTask(row)));
  }

  private readonly customerSelection = '+reviewReason +acceptanceRecovery';

  private async response(
    row: ServiceOrderDocument,
    contexts?: Awaited<ReturnType<ServiceOrdersService['requestContexts']>>,
  ) {
    await this.executionTask(row);
    const context = contexts ?? (await this.requestContexts([row], false));
    const booking = context.bookings.get(String(row.booking));
    return {
      id: String(row._id),
      bookingId: String(row.booking),
      bookingCode: booking?.code ?? null,
      roomNumbers: booking?.roomNumbers ?? [],
      serviceId: String(row.service),
      service: { name: row.serviceName, unit: row.unit },
      quantity: row.quantity,
      unitPriceVND: row.unitPriceVND,
      amount: row.amount,
      requestedTime: row.requestedTime,
      reviewStatus: row.reviewStatus,
      ...([
        ServiceOrderReviewStatus.Rejected,
        ServiceOrderReviewStatus.Abandoned,
      ].includes(row.reviewStatus)
        ? {
            reviewReason:
              row.acceptanceRecovery?.rejectionReason ?? row.reviewReason ?? '',
          }
        : {}),
      executionStatus: row.executionStatus,
      ...(row.notes === undefined ? {} : { notes: row.notes }),
      createdAt: row.createdAt,
    };
  }

  private async replay(
    customer: Types.ObjectId,
    requestId: string,
    fingerprint: string,
  ) {
    const row = await this.orders
      .findOne({ customer, requestId })
      .select(`+requestFingerprint ${this.customerSelection}`)
      .exec();
    if (!row) return null;
    await this.ownedBooking(row.booking, customer, 'orderable');
    if (row.requestFingerprint !== fingerprint)
      throw new ConflictException(
        'requestId already used with a different payload',
      );
    return this.response(row);
  }

  async create(dto: CreateServiceOrderDto, user: AuthUser) {
    const customer = this.customer(user);
    const booking = this.id(dto.bookingId);
    const serviceId = this.id(dto.serviceId);
    const stay = await this.ownedBooking(booking, customer, 'orderable');
    if (
      dto.requestedTime !== undefined &&
      !this.withinStay(new Date(dto.requestedTime), stay)
    )
      throw new BadRequestException('requestedTime must be within stay');
    if (!Number.isSafeInteger(dto.quantity) || dto.quantity < 1)
      throw new BadRequestException('quantity must be a positive safe integer');
    const requestedTime =
      dto.requestedTime === undefined ? undefined : new Date(dto.requestedTime);
    if (requestedTime && !Number.isFinite(requestedTime.getTime()))
      throw new BadRequestException('Invalid requestedTime');
    const notes = dto.notes?.trim() || undefined;
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          bookingId: String(booking),
          serviceId: String(serviceId),
          quantity: dto.quantity,
          requestedTime: requestedTime?.toISOString() ?? null,
          notes: notes ?? null,
        }),
      )
      .digest('hex');
    if (dto.requestId) {
      const existing = await this.replay(customer, dto.requestId, fingerprint);
      if (existing) return existing;
    }
    const service = await this.services.findById(serviceId).exec();
    if (!service) throw new NotFoundException('Service not found');
    if (service.isActive !== true)
      throw new ConflictException('Service is not available for ordering');
    const price = service.billable === false ? 0 : service.price;
    if (typeof price !== 'number' || !Number.isSafeInteger(price) || price < 0)
      throw new BadRequestException(
        'Service price must be a safe non-negative VND integer',
      );
    const amount = price * dto.quantity;
    if (!Number.isSafeInteger(amount))
      throw new BadRequestException('Order amount exceeds safe integer VND');
    try {
      const row = await this.orders.create({
        customer,
        booking,
        service: serviceId,
        serviceName: service.name,
        unit: service.unit ?? '',
        quantity: dto.quantity,
        unitPriceVND: price,
        amount,
        requestedTime: requestedTime ?? new Date(),
        ...(notes ? { notes } : {}),
        ...(dto.requestId
          ? { requestId: dto.requestId, requestFingerprint: fingerprint }
          : {}),
      });
      return this.response(row);
    } catch (error) {
      if (dto.requestId && (error as { code?: number }).code === 11000) {
        const existing = await this.replay(
          customer,
          dto.requestId,
          fingerprint,
        );
        if (existing) return existing;
      }
      throw error;
    }
  }

  /**
   * Tự sinh ServiceOrder từ dịch vụ khách đã chọn khi đặt, gọi khi booking qua CONFIRMED.
   * Idempotent qua requestId tất định (booking+service) nên callback thanh toán lặp hay
   * gọi lại nhiều lần không tạo trùng. Khách vãng lai (booking không có customer) vẫn sinh
   * đơn với customer để trống — lễ tân xem qua hàng đợi review, gắn tài khoản sau nếu cần.
   * Best-effort: bỏ qua dịch vụ đã ngừng/không hợp lệ. Trả số đơn vừa tạo.
   */
  async generateForConfirmedBooking(bookingId: string): Promise<number> {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) return 0;
    const booking = await this.bookings
      .findById(bookingId)
      .select('customer serviceSelections checkIn')
      .lean();
    if (!booking?.serviceSelections?.length) return 0;
    const bookingObjectId = new Types.ObjectId(bookingId);
    let created = 0;
    for (const selection of booking.serviceSelections) {
      const service = await this.services.findById(selection.service).exec();
      if (!service || service.isActive !== true) continue;
      const price = service.billable === false ? 0 : service.price;
      if (
        typeof price !== 'number' ||
        !Number.isSafeInteger(price) ||
        price < 0
      )
        continue;
      const amount = price * selection.quantity;
      if (!Number.isSafeInteger(amount)) continue;
      const requestId = `booking:${bookingObjectId}:service:${String(selection.service)}`;
      if (await this.orders.exists({ booking: bookingObjectId, requestId }))
        continue;
      try {
        await this.orders.create({
          ...(booking.customer ? { customer: booking.customer } : {}),
          booking: bookingObjectId,
          service: selection.service,
          serviceName: service.name,
          unit: service.unit ?? '',
          quantity: selection.quantity,
          unitPriceVND: price,
          amount,
          requestedTime: booking.checkIn ?? new Date(),
          reviewStatus: ServiceOrderReviewStatus.PendingReview,
          executionStatus: ServiceOrderExecutionStatus.NotStarted,
          requestId,
          requestFingerprint: requestId,
        });
        created++;
      } catch (error) {
        // Đã sinh trước đó (unique requestId): bỏ qua để idempotent.
        if ((error as { code?: number }).code === 11000) continue;
        throw error;
      }
    }
    return created;
  }

  /**
   * Gắn các đơn auto-sinh cho khách vãng lai (chưa có customer) vào một tài khoản, ví dụ
   * khi khách tạo tài khoản sau. Chỉ đụng đơn của booking đó còn để trống customer.
   */
  async linkBookingOrdersToCustomer(
    bookingId: Types.ObjectId | string,
    customerId: Types.ObjectId | string,
  ): Promise<number> {
    const result = await this.orders.updateMany(
      {
        booking: new Types.ObjectId(String(bookingId)),
        customer: { $exists: false },
      },
      { $set: { customer: new Types.ObjectId(String(customerId)) } },
    );
    return result.modifiedCount;
  }

  async list(query: ListServiceOrdersQuery, user: AuthUser) {
    const customer = this.customer(user);
    const bookings = await this.bookings
      .find({ customer })
      .select('_id')
      .exec();
    const filter = {
      customer,
      booking: { $in: bookings.map((row) => row._id) },
      ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
      ...(query.executionStatus
        ? { executionStatus: query.executionStatus }
        : {}),
      ...(query.keyword
        ? {
            serviceName: {
              $regex: query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
    };
    const { executionStatus: _executionStatus, ...repairScope } = filter;
    await this.repairExecutionScope(repairScope);
    const [rows, total] = await Promise.all([
      this.orders
        .find(filter)
        .select(this.customerSelection)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.orders.countDocuments(filter).exec(),
    ]);
    const contexts = await this.requestContexts(rows, false);
    return {
      items: await Promise.all(rows.map((row) => this.response(row, contexts))),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string, user: AuthUser) {
    const customer = this.customer(user);
    const row = await this.orders
      .findOne({ _id: this.id(id), customer })
      .select(this.customerSelection)
      .exec();
    if (!row) throw new NotFoundException('Service order not found');
    await this.ownedBooking(row.booking, customer);
    return this.response(row);
  }

  private receptionist(user: AuthUser) {
    if (!user) throw new UnauthorizedException();
    if (user.role !== Role.Receptionist) throw new ForbiddenException();
    return this.id(user.id);
  }

  private staffSelection =
    '+reviewedBy +reviewedAt +reviewDecision +reviewReason +acceptanceRecovery +billedInvoiceId +billedAt +assignmentAssignee +assignmentDueAt';

  private async requestContexts(
    rows: ServiceOrderDocument[],
    includeStaff = true,
  ) {
    const bookingIds = [...new Set(rows.map((row) => String(row.booking)))];
    const userIds = includeStaff
      ? [
          ...new Set(
            rows.flatMap((row) =>
              [
                row.customer,
                row.reviewedBy,
                row.reportedBy,
                row.createdBy,
                row.actualPerformer,
              ].flatMap((id) => (id ? [String(id)] : [])),
            ),
          ),
        ]
      : [];
    const [bookings, customers] = await Promise.all([
      bookingIds.length
        ? this.bookings
            .find({ _id: { $in: bookingIds } })
            .select('code status checkIn checkOut rooms')
            .exec()
        : [],
      userIds.length
        ? this.users
            .find({ _id: { $in: userIds } })
            .select('fullName')
            .exec()
        : [],
    ]);
    const roomIds = [
      ...new Set([
        ...bookings.flatMap((booking) => (booking.rooms ?? []).map(String)),
        ...rows.flatMap((row) => (row.room ? [String(row.room)] : [])),
      ]),
    ];
    const rooms = roomIds.length
      ? await this.bookings.db
          .collection('rooms')
          .find(
            { _id: { $in: roomIds.map((id) => new Types.ObjectId(id)) } },
            { projection: { roomNumber: 1 } },
          )
          .toArray()
      : [];
    const roomNumbers = new Map(
      rooms.map((room) => [String(room._id), room.roomNumber as string]),
    );
    return {
      roomNumbers,
      bookings: new Map(
        bookings.map((booking) => [
          String(booking._id),
          {
            code: booking.code,
            status: booking.status,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            roomNumbers: (booking.rooms ?? []).flatMap((id) => {
              const number = roomNumbers.get(String(id));
              return typeof number === 'string' ? [number] : [];
            }),
          },
        ]),
      ),
      customers: new Map(
        customers.map((customer) => [String(customer._id), customer]),
      ),
    };
  }

  private async staffResponse(
    row: ServiceOrderDocument,
    contexts?: Awaited<ReturnType<ServiceOrdersService['requestContexts']>>,
  ) {
    const context = contexts ?? (await this.requestContexts([row]));
    const booking = context.bookings.get(String(row.booking));
    const customer = context.customers.get(String(row.customer));
    const reviewer = context.customers.get(String(row.reviewedBy));
    return {
      ...(await this.response(row, context)),
      task: await this.taskSummary(row),
      ...(row.intakeMode
        ? {
            intakeMode: row.intakeMode,
            intakeRole: row.intakeRole,
            createdBy: String(row.createdBy),
            reportedBy: String(row.reportedBy),
            reportedByName:
              context.customers.get(String(row.reportedBy))?.fullName ?? null,
            createdByName:
              context.customers.get(String(row.createdBy))?.fullName ?? null,
            actualPerformerName:
              context.customers.get(String(row.actualPerformer))?.fullName ??
              null,
            roomNumber: row.room
              ? (context.roomNumbers.get(String(row.room)) ?? null)
              : null,
            requesterName: row.requesterName ?? null,
            roomId: row.room ? String(row.room) : null,
            actualPerformerId: row.actualPerformer
              ? String(row.actualPerformer)
              : null,
            actualCompletedAt: row.actualCompletedAt ?? null,
            completionDetails: row.completionDetails ?? null,
          }
        : {}),
      ...(row.executionStatus === ServiceOrderExecutionStatus.Assigning &&
      row.assignmentAssignee
        ? {
            assignmentIntent: {
              assigneeId: String(row.assignmentAssignee),
              ...(row.assignmentDueAt
                ? { dueAt: row.assignmentDueAt.toISOString() }
                : {}),
            },
          }
        : {}),
      customer: {
        id: row.customer ? String(row.customer) : null,
        fullName: customer?.fullName ?? null,
      },
      booking: booking
        ? {
            code: booking.code,
            status: booking.status,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            roomNumbers: booking.roomNumbers,
          }
        : null,
      feeRequired: row.amount > 0,
      billingStatus:
        row.billedInvoiceId && row.billedAt
          ? 'BILLED'
          : row.amount > 0 &&
              row.reviewDecision === 'ACCEPT' &&
              !row.acceptanceRecovery
            ? 'PENDING'
            : 'NOT_REQUIRED',
      ...(row.reviewDecision
        ? {
            review: {
              decision: row.reviewDecision,
              reason:
                row.acceptanceRecovery?.rejectionReason ??
                row.reviewReason ??
                '',
              reviewedBy: String(row.reviewedBy),
              reviewedByName: reviewer?.fullName ?? null,
              reviewedAt: row.reviewedAt,
            },
          }
        : {}),
      ...(row.acceptanceRecovery
        ? { acceptanceRecovery: row.acceptanceRecovery }
        : {}),
      ...(row.billedInvoiceId
        ? { invoiceId: String(row.billedInvoiceId), billedAt: row.billedAt }
        : {}),
    };
  }

  async requests(query: ListServiceOrdersQuery, user: AuthUser) {
    this.receptionist(user);
    const filter = {
      reviewStatus:
        query.reviewStatus ?? ServiceOrderReviewStatus.PendingReview,
      ...(query.executionStatus
        ? { executionStatus: query.executionStatus }
        : {}),
      ...(query.keyword
        ? {
            serviceName: {
              $regex: query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
    };
    const { executionStatus: _executionStatus, ...repairScope } = filter;
    await this.repairExecutionScope(repairScope);
    const [rows, total] = await Promise.all([
      this.orders
        .find(filter)
        .select(this.staffSelection)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.orders.countDocuments(filter).exec(),
    ]);
    const contexts = await this.requestContexts(rows);
    return {
      items: await Promise.all(
        rows.map((row) => this.staffResponse(row, contexts)),
      ),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async requestDetail(id: string, user: AuthUser) {
    this.receptionist(user);
    const row = await this.orders
      .findById(this.id(id))
      .select(this.staffSelection)
      .exec();
    if (!row) throw new NotFoundException('Service order not found');
    return this.staffResponse(row);
  }

  private validateAmount(row: ServiceOrderDocument) {
    if (
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1 ||
      !Number.isSafeInteger(row.unitPriceVND) ||
      row.unitPriceVND < 0 ||
      !Number.isSafeInteger(row.amount) ||
      row.amount < 0 ||
      !Number.isSafeInteger(row.unitPriceVND * row.quantity) ||
      row.amount !== row.unitPriceVND * row.quantity
    )
      throw new ConflictException('Invalid service order price snapshot');
  }

  private matchingCharge(invoice: InvoiceDocument, row: ServiceOrderDocument) {
    if (!invoice.isActive || String(invoice.booking) !== String(row.booking))
      throw new ConflictException(
        'Invoice does not match service order booking',
      );
    const charges = invoice.charges.filter(
      (charge) => charge.sourceId === String(row._id),
    );
    if (charges.length === 0) return false;
    if (
      charges.length !== 1 ||
      charges.some(
        (charge) =>
          charge.type !== InvoiceChargeType.Service ||
          charge.amount !== row.amount ||
          charge.reason !== `Service order ${row._id}` ||
          charge.approved !== true,
      )
    )
      throw new ConflictException(
        'Invoice charge conflicts with service order',
      );
    return true;
  }

  async review(id: string, dto: ReviewServiceOrderDto, user: AuthUser) {
    try {
      this.receptionist(user);
      const orderId = this.id(id);
      const order = await this.orders.findById(orderId).exec();
      if (!order) throw new NotFoundException('Service order not found');
      await withBookingFinancialOperation(
        this.bookings,
        String(order.booking),
        async () => {
          try {
            return await this.reviewOrder(id, dto, user);
          } finally {
            const current = await this.orders.findById(orderId).exec();
            if (
              current &&
              current.reviewStatus !== ServiceOrderReviewStatus.Accepting &&
              (dto.recoveryAction === undefined ||
                current.reviewStatus === ServiceOrderReviewStatus.Abandoned)
            ) {
              await this.bookings.updateOne(
                { _id: order.booking },
                {
                  $pull: {
                    acceptanceReservations: String(orderId),
                    ...(current.reviewStatus ===
                    ServiceOrderReviewStatus.Accepted
                      ? { financialReconciliationOrderIds: String(orderId) }
                      : {}),
                  },
                },
              );
            }
          }
        },
      );
      const current = await this.assignmentOrder(id);
      await this.reconcileIntake(current, user);
      return this.staffResponse(await this.assignmentOrder(id));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Review temporarily unavailable; retry the same review',
      );
    }
  }

  private async abandonExpired(
    row: ServiceOrderDocument,
    dto: ReviewServiceOrderDto,
    reviewer: Types.ObjectId,
    reason: string,
  ) {
    if (
      dto.decision !== 'REJECT' ||
      typeof dto.recoveryReason !== 'string' ||
      !dto.recoveryReason.trim() ||
      dto.recoveryReason.trim().length > 2000
    )
      throw new BadRequestException(
        'Expired abandonment requires REJECT and a nonblank recovery reason',
      );
    const recoveryReason = dto.recoveryReason.trim();
    if (row.acceptanceRecovery) {
      if (
        row.reviewStatus !== ServiceOrderReviewStatus.Abandoned ||
        row.acceptanceRecovery.action !== 'ABANDON_EXPIRED' ||
        row.acceptanceRecovery.reason !== recoveryReason ||
        row.acceptanceRecovery.rejectionReason !== reason
      )
        throw new ConflictException(
          'A different acceptance recovery already exists',
        );
    } else {
      const now = new Date();
      this.validateAmount(row);
      if (
        row.reviewStatus !== ServiceOrderReviewStatus.Accepting ||
        row.reviewDecision !== 'ACCEPT' ||
        !row.reviewedBy ||
        !Types.ObjectId.isValid(String(row.reviewedBy)) ||
        !row.reviewedAt ||
        !Number.isFinite(row.reviewedAt.getTime()) ||
        row.reviewedAt > row.requestedTime ||
        row.reviewedAt > now ||
        row.intakeRole === Role.ServiceStaff ||
        row.intakeMode === 'COMPLETED_ON_SITE' ||
        row.actualPerformer ||
        row.actualCompletedAt ||
        row.completionDetails ||
        row.executionStatus !== ServiceOrderExecutionStatus.NotStarted ||
        row.billedInvoiceId ||
        row.billedAt ||
        row.linkedTask ||
        row.assignmentTaskId
      )
        throw new ConflictException('Acceptance cannot be safely abandoned');
      const booking = await this.ownedBooking(row.booking, row.customer).catch(
        () => {
          throw new ConflictException(
            'Booking evidence could not be established',
          );
        },
      );
      if (
        !booking.isActive ||
        booking.status !== BookingStatus.Confirmed ||
        !Number.isFinite(row.requestedTime?.getTime()) ||
        !Number.isFinite(booking.checkIn?.getTime()) ||
        !Number.isFinite(booking.checkOut?.getTime()) ||
        row.requestedTime > now ||
        row.requestedTime < booking.checkIn ||
        row.requestedTime >= booking.checkOut
      )
        throw new ConflictException(
          'Recovery requires an expired scheduled CONFIRMED booking',
        );
      try {
        const [charge, task] = await Promise.all([
          this.invoiceRecords.exists({ 'charges.sourceId': String(row._id) }),
          this.orders.db.model<Task>('Task').exists({
            sourceType: TaskSourceType.ServiceOrder,
            sourceId: row._id,
          }),
        ]);
        if (charge || task)
          throw new ConflictException(
            'Existing charge or task prevents acceptance recovery',
          );
      } catch {
        throw new ConflictException(
          'No-charge and no-task evidence could not be established',
        );
      }
      const recovered = await this.orders
        .findOneAndUpdate(
          {
            _id: row._id,
            reviewStatus: ServiceOrderReviewStatus.Accepting,
            reviewDecision: 'ACCEPT',
            reviewedBy: row.reviewedBy,
            reviewedAt: row.reviewedAt,
            reviewReason: row.reviewReason ?? { $exists: false },
            executionStatus: ServiceOrderExecutionStatus.NotStarted,
            acceptanceRecovery: { $exists: false },
            billedInvoiceId: { $exists: false },
            billedAt: { $exists: false },
            linkedTask: { $exists: false },
            assignmentTaskId: { $exists: false },
            intakeRole: row.intakeRole ?? { $exists: false },
            intakeMode: row.intakeMode ?? { $exists: false },
            actualPerformer: { $exists: false },
            actualCompletedAt: { $exists: false },
            completionDetails: { $exists: false },
            requestedTime: row.requestedTime,
            quantity: row.quantity,
            unitPriceVND: row.unitPriceVND,
            amount: row.amount,
          },
          {
            $set: {
              reviewStatus: ServiceOrderReviewStatus.Abandoned,
              acceptanceRecovery: {
                decision: 'REJECT',
                action: 'ABANDON_EXPIRED',
                reason: recoveryReason,
                rejectionReason: reason,
                actor: reviewer,
                actorRole: Role.Receptionist,
                at: now,
                previousReviewStatus: ServiceOrderReviewStatus.Accepting,
                resultingReviewStatus: ServiceOrderReviewStatus.Abandoned,
                evidence: {
                  chargeExpected: row.amount > 0,
                  sourceChargeAbsent: true,
                  taskAbsent: true,
                  bookingStatus: booking.status,
                  checkIn: booking.checkIn,
                  checkOut: booking.checkOut,
                  requestedTime: row.requestedTime,
                  reviewedBy: row.reviewedBy,
                  reviewedAt: row.reviewedAt,
                  reviewDecision: row.reviewDecision,
                  reviewReason: row.reviewReason,
                  quantity: row.quantity,
                  unitPriceVND: row.unitPriceVND,
                  amount: row.amount,
                },
              },
            },
          },
          { new: true, runValidators: true },
        )
        .select(this.staffSelection)
        .exec();
      if (!recovered) throw new ConflictException('Acceptance intent changed');
      row = recovered;
    }
    await this.bookings.updateOne(
      { _id: row.booking },
      {
        $pull: {
          financialReconciliationOrderIds: String(row._id),
          acceptanceReservations: String(row._id),
        },
      },
    );
    return this.staffResponse(row);
  }

  private async reviewOrder(
    id: string,
    dto: ReviewServiceOrderDto,
    user: AuthUser,
  ) {
    const reviewer = this.receptionist(user);
    const orderId = this.id(id);
    if (
      !['ACCEPT', 'REJECT'].includes(dto.decision) ||
      (dto.reason !== undefined && typeof dto.reason !== 'string')
    )
      throw new BadRequestException('Invalid review decision or reason');
    const reason = dto.reason?.trim() ?? '';
    if (reason.length > 2000 || (dto.decision === 'REJECT' && !reason))
      throw new BadRequestException(
        'Rejection requires a nonblank reason of at most 2000 characters',
      );
    let row = await this.orders
      .findById(orderId)
      .select(this.staffSelection)
      .exec();
    if (!row) throw new NotFoundException('Service order not found');
    if (dto.recoveryAction !== undefined) {
      if (dto.recoveryAction !== 'ABANDON_EXPIRED')
        throw new BadRequestException('Invalid recovery action');
      return this.abandonExpired(row, dto, reviewer, reason);
    }
    if (dto.recoveryReason !== undefined) {
      if (
        typeof dto.recoveryReason !== 'string' ||
        !dto.recoveryReason.trim() ||
        dto.recoveryReason.trim().length > 2000 ||
        dto.decision !== 'REJECT'
      )
        throw new BadRequestException(
          'Recovery requires REJECT and a nonblank recovery reason',
        );
      const recoveryReason = dto.recoveryReason.trim();
      if (row.acceptanceRecovery) {
        if (
          row.reviewStatus !== ServiceOrderReviewStatus.Rejected ||
          row.acceptanceRecovery.reason !== recoveryReason ||
          row.acceptanceRecovery.rejectionReason !== reason
        )
          throw new ConflictException(
            'A different acceptance recovery already exists',
          );
        await this.bookings.updateOne(
          { _id: row.booking },
          { $pull: { financialReconciliationOrderIds: String(orderId) } },
        );
        return this.staffResponse(row);
      }
      if (
        row.reviewStatus !== ServiceOrderReviewStatus.Accepting ||
        row.reviewDecision !== 'ACCEPT' ||
        !row.reviewedBy ||
        !row.reviewedAt ||
        row.executionStatus !== ServiceOrderExecutionStatus.NotStarted ||
        row.billedInvoiceId ||
        row.billedAt ||
        row.linkedTask ||
        row.assignmentTaskId
      )
        throw new ConflictException('Acceptance cannot be safely abandoned');
      const booking = await this.ownedBooking(row.booking, row.customer);
      if (
        ![BookingStatus.CheckedOut, BookingStatus.Cancelled].includes(
          booking.status,
        )
      )
        throw new ConflictException(
          'Acceptance recovery requires a closed booking',
        );
      const [charge, task] = await Promise.all([
        this.invoiceRecords.exists({ 'charges.sourceId': String(orderId) }),
        this.orders.db.model<Task>('Task').exists({
          sourceType: TaskSourceType.ServiceOrder,
          sourceId: orderId,
        }),
      ]);
      if (charge || task)
        throw new ConflictException(
          'Existing charge or task prevents acceptance recovery',
        );
      const recovered = await this.orders
        .findOneAndUpdate(
          {
            _id: orderId,
            reviewStatus: ServiceOrderReviewStatus.Accepting,
            reviewDecision: 'ACCEPT',
            executionStatus: ServiceOrderExecutionStatus.NotStarted,
            acceptanceRecovery: { $exists: false },
            billedInvoiceId: { $exists: false },
            billedAt: { $exists: false },
            linkedTask: { $exists: false },
            assignmentTaskId: { $exists: false },
          },
          {
            $set: {
              reviewStatus: ServiceOrderReviewStatus.Rejected,
              executionStatus: ServiceOrderExecutionStatus.NotStarted,
              acceptanceRecovery: {
                decision: 'REJECT',
                reason: recoveryReason,
                rejectionReason: reason,
                actor: reviewer,
                at: new Date(),
              },
            },
          },
          { new: true, runValidators: true },
        )
        .select(this.staffSelection)
        .exec();
      if (!recovered) throw new ConflictException('Acceptance intent changed');
      await this.bookings.updateOne(
        { _id: row.booking },
        { $pull: { financialReconciliationOrderIds: String(orderId) } },
      );
      return this.staffResponse(recovered);
    }
    if (row.acceptanceRecovery)
      throw new ConflictException(
        'Acceptance was abandoned by audited recovery',
      );
    if (row.reviewStatus === ServiceOrderReviewStatus.PendingReview) {
      this.validateAmount(row);
      if (dto.decision === 'ACCEPT') {
        const booking = await this.ownedBooking(row.booking, row.customer);
        if (!this.scheduledAcceptance(row, booking))
          throw new ConflictException(
            'Booking must be active and CHECKED_IN or valid future scheduled CONFIRMED',
          );
        const reserved = await this.bookings.updateOne(
          {
            _id: row.booking,
            ...(row.customer ? { customer: row.customer } : {}),
            isActive: true,
            status: booking.status,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
          },
          { $addToSet: { acceptanceReservations: String(orderId) } },
        );
        if (reserved.matchedCount !== 1)
          throw new ConflictException('Booking must be active and CHECKED_IN');
      }
      const claimed = await this.orders
        .findOneAndUpdate(
          {
            _id: orderId,
            reviewStatus: ServiceOrderReviewStatus.PendingReview,
          },
          {
            $set: {
              reviewStatus:
                dto.decision === 'REJECT'
                  ? ServiceOrderReviewStatus.Rejected
                  : ServiceOrderReviewStatus.Accepting,
              reviewedBy: reviewer,
              reviewedAt: new Date(),
              reviewDecision: dto.decision,
              reviewReason: reason,
            },
          },
          { new: true, runValidators: true },
        )
        .select(this.staffSelection)
        .exec();
      row =
        claimed ??
        (await this.orders
          .findById(orderId)
          .select(this.staffSelection)
          .exec());
      if (!row) throw new NotFoundException('Service order not found');
    }
    if (
      row.reviewDecision !== dto.decision ||
      (row.reviewReason ?? '') !== reason
    )
      throw new ConflictException(
        'Service order already has a different review intent',
      );
    if (
      row.reviewStatus === ServiceOrderReviewStatus.Rejected ||
      row.reviewStatus === ServiceOrderReviewStatus.Accepted
    ) {
      return this.staffResponse(row);
    }
    if (row.reviewStatus !== ServiceOrderReviewStatus.Accepting)
      throw new ConflictException('Service order is no longer pending');
    this.validateAmount(row);
    await this.bookings.updateOne(
      { _id: row.booking, status: BookingStatus.CheckedIn, isActive: true },
      { $addToSet: { acceptanceReservations: String(orderId) } },
    );
    try {
      let invoice: InvoiceDocument | undefined;
      if (row.amount === 0) {
        const booking = await this.ownedBooking(row.booking, row.customer);
        if (
          booking.status === BookingStatus.Confirmed &&
          !this.scheduledAcceptance(row, booking)
        ) {
          await this.bookings.updateOne(
            { _id: row.booking },
            { $addToSet: { financialReconciliationOrderIds: String(orderId) } },
          );
          throw new ConflictException(
            'Expired unbilled scheduled acceptance requires explicit abandonment',
          );
        }
      }
      if (row.amount > 0) {
        invoice = await this.invoices.getOrCreateForBooking(
          String(row.booking),
        );
        if (!this.matchingCharge(invoice, row)) {
          const booking = await this.ownedBooking(row.booking, row.customer);
          if (!this.scheduledAcceptance(row, booking)) {
            await this.bookings.updateOne(
              { _id: row.booking },
              {
                $addToSet: {
                  financialReconciliationOrderIds: String(orderId),
                },
              },
            );
            throw new ConflictException(
              booking.status === BookingStatus.Confirmed
                ? 'Expired scheduled acceptance requires reconciliation; no new charge created'
                : 'Unbilled acceptance on closed booking requires reconciliation; no new charge created',
            );
          }
          try {
            await this.invoices.addCharge({
              bookingId: String(row.booking),
              type: InvoiceChargeType.Service,
              amount: row.amount,
              sourceId: String(row._id),
              reason: `Service order ${row._id}`,
            });
          } catch (error) {
            const persisted = await this.invoices.getOrCreateForBooking(
              String(row.booking),
            );
            if (!this.matchingCharge(persisted, row)) throw error;
          }
          invoice = await this.invoices.getOrCreateForBooking(
            String(row.booking),
          );
          if (!this.matchingCharge(invoice, row))
            throw new ServiceUnavailableException(
              'Billing not persisted; retry the same review',
            );
        }
      }
      const finalized = await this.orders
        .findOneAndUpdate(
          {
            _id: orderId,
            reviewStatus: ServiceOrderReviewStatus.Accepting,
            reviewDecision: 'ACCEPT',
            reviewReason: reason,
          },
          {
            $set: {
              reviewStatus: ServiceOrderReviewStatus.Accepted,
              ...(invoice
                ? { billedInvoiceId: invoice._id, billedAt: new Date() }
                : {}),
            },
          },
          { new: true, runValidators: true },
        )
        .select(this.staffSelection)
        .exec();
      const result =
        finalized ??
        (await this.orders
          .findById(orderId)
          .select(this.staffSelection)
          .exec());
      if (!result || result.reviewStatus !== ServiceOrderReviewStatus.Accepted)
        throw new ServiceUnavailableException(
          'Review finalization pending; retry the same review',
        );
      return this.staffResponse(result);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Review temporarily unavailable; retry the same review',
      );
    }
  }

  private assignmentSelection =
    '+assignmentAssignee +assignmentRequestedBy +assignmentRequestedAt +assignmentDueAt +assignmentTitle +assignmentRecoveryAudit';

  async reassign(id: string, input: ReassignServiceOrderDto, user: AuthUser) {
    const actor = this.receptionist(user);
    const dto = plainToInstance(ReassignServiceOrderDto, input);
    if (
      !input ||
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
        .length
    )
      throw new BadRequestException('Invalid reassignment input');
    const row = await this.assignmentOrder(id);
    await this.assertAssignable(row);
    if (
      !row.linkedTask ||
      String(row.linkedTask) !== String(row.assignmentTaskId)
    )
      throw new ConflictException('Canonical task required');
    await this.tasks.reassignServiceOrderExecution(
      id,
      row.linkedTask,
      dto,
      String(actor),
    );
    return this.staffResponse(await this.assignmentOrder(id));
  }

  private async assignmentOrder(id: string) {
    const row = await this.orders
      .findById(this.id(id))
      .select(`${this.staffSelection} ${this.assignmentSelection}`)
      .exec();
    if (!row) throw new NotFoundException('Service order not found');
    return row;
  }

  private async assertAssignable(row: ServiceOrderDocument) {
    if (row.intakeMode === 'COMPLETED_ON_SITE')
      throw new ConflictException(
        'Completed-on-site report cannot have a task',
      );
    if (row.reviewStatus !== ServiceOrderReviewStatus.Accepted)
      throw new ConflictException('Service order must be ACCEPTED');
    this.validateAmount(row);
    if (row.amount > 0) {
      if (!row.billedInvoiceId || !row.billedAt)
        throw new ConflictException('Service order billing is not confirmed');
      const invoice = await this.invoiceRecords
        .findById(row.billedInvoiceId)
        .exec();
      if (!invoice || !this.matchingCharge(invoice, row))
        throw new ConflictException('Persisted service charge is missing');
    }
  }

  async assignees(id: string, user: AuthUser) {
    this.receptionist(user);
    const row = await this.assignmentOrder(id);
    await this.assertAssignable(row);
    if (row.executionStatus === ServiceOrderExecutionStatus.Assigned) {
      if (
        !row.linkedTask ||
        String(row.linkedTask) !== String(row.assignmentTaskId)
      )
        throw new ConflictException('Canonical task required');
      const task = await this.tasks.findServiceOrderExecutionWork(
        String(row._id),
        row.linkedTask,
      );
      this.assertAssignmentTask(row, task);
      if (
        !task ||
        task.status !== 'ASSIGNED' ||
        task.completedAt ||
        task.workResult ||
        task.cancellation
      )
        throw new ConflictException(
          'Only unchanged ASSIGNED work can be reassigned',
        );
    } else if (
      ![
        ServiceOrderExecutionStatus.NotStarted,
        ServiceOrderExecutionStatus.Assigning,
      ].includes(row.executionStatus)
    )
      throw new ConflictException('Service order is already assigned');
    const items = await this.users
      .find({ isActive: true, role: Role.ServiceStaff })
      .select('_id fullName role')
      .sort({ fullName: 1, _id: 1 })
      .lean();
    let recoveryAllowed = false;
    if (
      row.executionStatus === ServiceOrderExecutionStatus.Assigning &&
      row.assignmentAssignee &&
      row.assignmentTaskId &&
      !row.linkedTask
    ) {
      const [previous, existing] = await Promise.all([
        this.users
          .findOne({ _id: row.assignmentAssignee, isActive: false })
          .lean(),
        this.orders.db.model<Task>('Task').exists({
          $or: [
            { _id: row.assignmentTaskId },
            { sourceType: TaskSourceType.ServiceOrder, sourceId: row._id },
          ],
        }),
      ]);
      recoveryAllowed = Boolean(previous && !existing);
    }
    return {
      recoveryAllowed,
      items: items.map((staff) => ({
        id: String(staff._id),
        displayName: staff.fullName,
        role: staff.role,
      })),
    };
  }

  private assertAssignmentIntent(
    row: ServiceOrderDocument,
    assigneeId: Types.ObjectId,
    dueAt: Date | undefined,
  ): asserts row is ServiceOrderDocument & {
    assignmentTaskId: Types.ObjectId;
    assignmentTitle: string;
    assignmentRequestedAt: Date;
  } {
    if (
      String(row.assignmentAssignee) !== String(assigneeId) ||
      row.assignmentDueAt?.getTime() !== dueAt?.getTime()
    )
      throw new ConflictException(
        'A different assignment intent already exists',
      );
    if (
      !row.assignmentTaskId ||
      !row.assignmentTitle ||
      !row.assignmentRequestedAt
    )
      throw new ConflictException('Assignment intent is incomplete');
  }

  private assertAssignmentTask(
    row: ServiceOrderDocument,
    task: (Task & { _id: Types.ObjectId }) | null,
  ) {
    if (
      !task ||
      String(task._id) !== String(row.assignmentTaskId) ||
      (String(task.assignedTo) !== String(row.assignmentAssignee) &&
        !(
          task.serviceOrderReassignments?.length &&
          task.serviceOrderReassignments[0].previousAssigneeId ===
            String(row.assignmentAssignee) &&
          task.serviceOrderReassignments.at(-1)?.assigneeId ===
            String(task.assignedTo)
        )) ||
      task.dueAt?.getTime() !== row.assignmentDueAt?.getTime() ||
      task.title !== row.assignmentTitle ||
      task.priority !== 'NORMAL' ||
      task.assignedAt.getTime() !== row.assignmentRequestedAt?.getTime()
    )
      throw new ConflictException(
        'Existing source work does not match assignment intent',
      );
  }

  private async assignmentReplay(row: ServiceOrderDocument) {
    if (
      !row.linkedTask ||
      String(row.linkedTask) !== String(row.assignmentTaskId) ||
      ![
        ServiceOrderExecutionStatus.Assigned,
        ServiceOrderExecutionStatus.InProgress,
        ServiceOrderExecutionStatus.Completed,
      ].includes(row.executionStatus)
    )
      throw new ConflictException('Assignment is not canonically finalized');
    const task = await this.tasks.findServiceOrderExecutionWork(
      String(row._id),
      row.linkedTask,
    );
    this.assertAssignmentTask(row, task);
    return this.staffResponse(row);
  }

  async assign(id: string, input: AssignServiceOrderDto, user: AuthUser) {
    const actor = this.receptionist(user);
    const dto = plainToInstance(AssignServiceOrderDto, input);
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
        .length
    )
      throw new BadRequestException('Invalid assignment input');
    const assigneeId = this.id(dto.assigneeId);
    const dueAt = dto.dueAt === undefined ? undefined : new Date(dto.dueAt);
    if (dueAt && !Number.isFinite(dueAt.getTime()))
      throw new BadRequestException('Invalid dueAt');
    const initial = await this.assignmentOrder(id);
    await this.assertAssignable(initial);
    return withBookingFinancialOperation(
      this.bookings,
      String(initial.booking),
      () => this.assignLocked(id, dto, assigneeId, dueAt, actor),
    );
  }

  private async assignLocked(
    id: string,
    dto: AssignServiceOrderDto,
    assigneeId: Types.ObjectId,
    dueAt: Date | undefined,
    actor: Types.ObjectId,
  ) {
    let row = await this.assignmentOrder(id);
    await this.assertAssignable(row);
    const recovering =
      row.executionStatus === ServiceOrderExecutionStatus.Assigning;
    if (
      dto.recoveryReason &&
      String(row.assignmentAssignee) === String(assigneeId)
    ) {
      this.assertAssignmentIntent(row, assigneeId, dueAt);
      const replacement = row.assignmentRecoveryAudit?.findLast(
        (entry) => String(entry.previousAssignee) !== String(entry.assignee),
      );
      if (
        !replacement ||
        String(replacement.assignee) !== String(assigneeId) ||
        replacement.reason !== dto.recoveryReason
      )
        throw new ConflictException(
          'A different recovery intent already exists',
        );
      if (!recovering) return this.assignmentReplay(row);
    } else if (dto.recoveryReason && !recovering) {
      throw new ConflictException('Recovery requires a pending assignment');
    }
    if (recovering && String(row.assignmentAssignee) !== String(assigneeId)) {
      if (!dto.recoveryReason)
        throw new ConflictException('Reassignment requires a recovery reason');
      if (!row.assignmentTaskId || !row.assignmentAssignee || row.linkedTask)
        throw new ConflictException('Assignment cannot be safely replaced');
      this.assertAssignmentIntent(row, row.assignmentAssignee, dueAt);
      const existing = await this.orders.db.model<Task>('Task').exists({
        $or: [
          { _id: row.assignmentTaskId },
          { sourceType: TaskSourceType.ServiceOrder, sourceId: row._id },
        ],
      });
      if (existing)
        throw new ConflictException(
          'Existing task owner cannot be changed by recovery',
        );
      const previous = await this.users
        .findOne({ _id: row.assignmentAssignee })
        .lean();
      if (!previous || previous.isActive !== false)
        throw new ConflictException('Previous assignee must be inactive');
      const replacement = await this.users
        .findOne({ _id: assigneeId, isActive: true, role: Role.ServiceStaff })
        .lean();
      if (!replacement)
        throw new BadRequestException('Assignee must be active SERVICE_STAFF');
      if (row.assignmentDueAt?.getTime() !== dueAt?.getTime())
        throw new ConflictException(
          'Recovery must preserve the persisted due date',
        );
      const replaced = await this.orders
        .findOneAndUpdate(
          {
            _id: row._id,
            executionStatus: ServiceOrderExecutionStatus.Assigning,
            reviewStatus: ServiceOrderReviewStatus.Accepted,
            assignmentTaskId: row.assignmentTaskId,
            assignmentAssignee: row.assignmentAssignee,
            linkedTask: { $exists: false },
          },
          {
            $set: { assignmentAssignee: assigneeId },
            $push: {
              assignmentRecoveryAudit: {
                actor,
                at: new Date(),
                previousAssignee: row.assignmentAssignee,
                assignee: assigneeId,
                reason: dto.recoveryReason,
              },
            },
          },
          { new: true, runValidators: true },
        )
        .select(`${this.staffSelection} ${this.assignmentSelection}`)
        .exec();
      if (!replaced) throw new ConflictException('Assignment intent changed');
      row = replaced;
    } else if (recovering && !dto.recoveryReason) {
      this.assertAssignmentIntent(row, assigneeId, dueAt);
      await this.orders.updateOne(
        {
          _id: row._id,
          executionStatus: ServiceOrderExecutionStatus.Assigning,
          assignmentTaskId: row.assignmentTaskId,
          assignmentAssignee: row.assignmentAssignee,
        },
        {
          $push: {
            assignmentRecoveryAudit: {
              actor,
              at: new Date(),
              previousAssignee: row.assignmentAssignee,
              assignee: row.assignmentAssignee,
              reason: dto.recoveryReason ?? 'Retry persisted assignment',
            },
          },
        },
      );
    }
    if (row.executionStatus === ServiceOrderExecutionStatus.NotStarted) {
      if (dueAt && dueAt.getTime() <= Date.now())
        throw new BadRequestException('Deadline must be in the future');
      const staff = await this.users
        .findOne({ _id: assigneeId, isActive: true, role: Role.ServiceStaff })
        .lean();
      if (!staff)
        throw new BadRequestException('Assignee must be active SERVICE_STAFF');
      const locked = await this.orders
        .findOneAndUpdate(
          {
            _id: row._id,
            reviewStatus: ServiceOrderReviewStatus.Accepted,
            executionStatus: ServiceOrderExecutionStatus.NotStarted,
            assignmentTaskId: { $exists: false },
            linkedTask: { $exists: false },
          },
          {
            $set: {
              executionStatus: ServiceOrderExecutionStatus.Assigning,
              assignmentAssignee: assigneeId,
              assignmentRequestedBy: actor,
              assignmentRequestedAt: new Date(),
              assignmentTitle: `Service order: ${row.serviceName}`,
              assignmentTaskId: new Types.ObjectId(),
              ...(dueAt ? { assignmentDueAt: dueAt } : {}),
            },
          },
          { new: true, runValidators: true },
        )
        .select(`${this.staffSelection} ${this.assignmentSelection}`)
        .exec();
      row = locked ?? (await this.assignmentOrder(id));
    }
    await this.assertAssignable(row);
    this.assertAssignmentIntent(row, assigneeId, dueAt);
    if (row.executionStatus !== ServiceOrderExecutionStatus.Assigning)
      return this.assignmentReplay(row);
    try {
      let task = await this.tasks.findServiceOrderExecutionWork(
        id,
        row.assignmentTaskId,
      );
      if (!task) {
        try {
          task = await this.tasks.create(
            {
              title: row.assignmentTitle,
              taskType: SERVICE_ORDER_EXECUTION_TASK_TYPE,
              priority: 'NORMAL',
              sourceType: TaskSourceType.ServiceOrder,
              sourceId: id,
              assigneeId: String(row.assignmentAssignee),
              ...(row.assignmentDueAt
                ? { dueAt: row.assignmentDueAt.toISOString() }
                : {}),
            },
            row.assignmentTaskId,
            row.assignmentRequestedAt,
          );
        } catch (error) {
          task = await this.tasks.findServiceOrderExecutionWork(
            id,
            row.assignmentTaskId,
          );
          if (!task) throw error;
        }
      }
      this.assertAssignmentTask(row, task);
      const finalized = await this.orders
        .findOneAndUpdate(
          {
            _id: row._id,
            reviewStatus: ServiceOrderReviewStatus.Accepted,
            executionStatus: ServiceOrderExecutionStatus.Assigning,
            assignmentTaskId: row.assignmentTaskId,
            linkedTask: { $exists: false },
          },
          { $set: { linkedTask: task._id, executionStatus: task.status } },
          { new: true, runValidators: true },
        )
        .select(this.staffSelection)
        .exec();
      if (!finalized) {
        const canonical = await this.assignmentOrder(id);
        await this.assertAssignable(canonical);
        this.assertAssignmentIntent(canonical, assigneeId, dueAt);
        if (
          String(canonical.assignmentTaskId) !== String(row.assignmentTaskId) ||
          String(canonical.assignmentRequestedBy) !==
            String(row.assignmentRequestedBy) ||
          canonical.assignmentTitle !== row.assignmentTitle ||
          canonical.assignmentRequestedAt?.getTime() !==
            row.assignmentRequestedAt?.getTime()
        )
          throw new ConflictException('Assignment intent changed');
        return await this.assignmentReplay(canonical);
      }
      return await this.staffResponse(finalized);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Assignment pending; retry the same assignment',
      );
    }
  }

  private taskResponse(task: Task & { _id: Types.ObjectId }, history = false) {
    return {
      id: String(task._id),
      status: task.status,
      assignedAt: task.assignedAt,
      ...(task.dueAt ? { dueAt: task.dueAt } : {}),
      ...(task.completedAt ? { completedAt: task.completedAt } : {}),
      ...(history ? { workResult: task.workResult } : {}),
    };
  }

  private async taskSummary(row: ServiceOrderDocument) {
    const task = await this.executionTask(row);
    if (!task) return null;
    const assignee = await this.users
      .findById(task.assignedTo)
      .select('fullName')
      .exec();
    return {
      ...this.taskResponse(task),
      assigneeId: String(task.assignedTo),
      assigneeName: assignee?.fullName ?? null,
      reassignments: task.serviceOrderReassignments ?? [],
    };
  }

  private serviceStaff(user: AuthUser) {
    if (!user || !/^[a-f\d]{24}$/i.test(user.id))
      throw new UnauthorizedException();
    if (user.role !== Role.ServiceStaff) throw new ForbiddenException();
  }

  async history(query: ServiceHistoryQuery, user: AuthUser, id?: string) {
    this.serviceStaff(user);
    if (query.from && query.to && new Date(query.from) > new Date(query.to))
      throw new BadRequestException('from must not be after to');
    const onsiteFilter = {
      actualPerformer: this.id(user.id),
      intakeMode: 'COMPLETED_ON_SITE',
      reviewStatus: ServiceOrderReviewStatus.Accepted,
      linkedTask: { $exists: false },
      ...(id ? { _id: this.id(id) } : {}),
      ...(query.from || query.to
        ? {
            actualCompletedAt: {
              ...(query.from ? { $gte: new Date(query.from) } : {}),
              ...(query.to ? { $lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.keyword
        ? {
            serviceName: {
              $regex: query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
    };
    const onsiteTotal = await this.orders.countDocuments(onsiteFilter).exec();
    const result = await this.tasks.listCompletedServiceWork(
      user.id,
      onsiteTotal
        ? { ...query, page: 1, limit: query.page * query.limit }
        : query,
      id ? this.id(id) : undefined,
    );
    const items = await Promise.all(
      result.items.map(async (task) => {
        const row = this.orders.hydrate(task.order);
        await this.tasks.repairServiceOrderExecution(task);
        row.executionStatus = ServiceOrderExecutionStatus.Completed;
        return {
          ...(await this.response(row)),
          task: this.taskResponse(task, true),
        };
      }),
    );
    if (onsiteTotal) {
      const onsite = await this.orders
        .find(onsiteFilter)
        .select(this.staffSelection)
        .sort({ actualCompletedAt: -1, _id: -1 })
        .limit(query.page * query.limit)
        .exec();
      const completed = await Promise.all(
        onsite.map(async (row) => ({
          ...(await this.response(row)),
          task: null,
          intakeMode: row.intakeMode,
          actualPerformerId: String(row.actualPerformer),
          actualCompletedAt: row.actualCompletedAt,
          completionDetails: row.completionDetails,
          executionStatus: ServiceOrderExecutionStatus.Completed,
        })),
      );
      const merged = [...items, ...completed].sort((a, b) => {
        const date = (value: typeof a) =>
          'actualCompletedAt' in value
            ? new Date(value.actualCompletedAt as Date).getTime()
            : new Date(value.task!.completedAt!).getTime();
        return date(b) - date(a) || b.id.localeCompare(a.id);
      });
      if (id) return merged[0];
      return {
        items: merged.slice(
          (query.page - 1) * query.limit,
          query.page * query.limit,
        ),
        total: result.total + onsiteTotal,
        page: query.page,
        limit: query.limit,
      };
    }
    if (id) {
      if (!items[0]) throw new NotFoundException('Service history not found');
      return items[0];
    }
    return { items, total: result.total, page: query.page, limit: query.limit };
  }

  async orderContexts(user: AuthUser) {
    const customer = this.customer(user);
    const rows = await this.bookings
      .find({
        customer,
        isActive: true,
        status: { $in: ORDERABLE_BOOKING_STATUSES },
      })
      .select('_id code status rooms checkIn checkOut')
      .sort({ checkIn: -1, _id: 1 })
      // Số phòng đầu tiên cho màn "Dịch vụ phòng"; phòng đã xoá chỉ làm thiếu số phòng.
      .populate<{ rooms: ({ roomNumber?: string } | null)[] }>({
        path: 'rooms',
        select: 'roomNumber',
        options: { retainNullValues: true },
      })
      .exec();
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        code: row.code,
        status: row.status,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        ...(row.rooms[0]?.roomNumber
          ? { roomNumber: row.rooms[0].roomNumber }
          : {}),
      })),
    };
  }

  async intakeContexts(user: AuthUser) {
    this.intakeActor(user);
    const rows = await this.bookings
      .find({
        isActive: true,
        status:
          user.role === Role.ServiceStaff
            ? BookingStatus.CheckedIn
            : { $in: ORDERABLE_BOOKING_STATUSES },
      })
      .select('_id code guestName guestPhone status checkIn checkOut rooms')
      .sort({ checkIn: -1, _id: 1 })
      .populate<{
        rooms: ({ _id: Types.ObjectId; roomNumber?: string } | null)[];
      }>({
        path: 'rooms',
        select: 'roomNumber',
        options: { retainNullValues: true },
      })
      .exec();
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        code: row.code,
        guestName: row.guestName,
        guestPhone: row.guestPhone,
        status: row.status,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        rooms: row.rooms.flatMap((room) =>
          room
            ? [{ id: String(room._id), roomNumber: room.roomNumber ?? null }]
            : [],
        ),
      })),
    };
  }

  async reports(query: ListServiceOrdersQuery, user: AuthUser, id?: string) {
    this.serviceStaff(user);
    const filter = {
      reportedBy: this.id(user.id),
      ...(query.keyword
        ? {
            serviceName: {
              $regex: query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
      ...(id ? { _id: this.id(id) } : {}),
      ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
      ...(query.executionStatus
        ? { executionStatus: query.executionStatus }
        : {}),
    };
    const { executionStatus: _executionStatus, ...repairScope } = filter;
    await this.repairExecutionScope(repairScope);
    const [rows, total] = await Promise.all([
      this.orders
        .find(filter)
        .select(this.staffSelection)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.orders.countDocuments(filter).exec(),
    ]);
    const items = await Promise.all(rows.map((row) => this.staffResponse(row)));
    if (id) {
      if (!items[0]) throw new NotFoundException('Service report not found');
      return items[0];
    }
    return { items, total, page: query.page, limit: query.limit };
  }

  async intakePerformers(user: AuthUser) {
    this.serviceStaff(user);
    const rows = await this.users
      .find({ role: Role.ServiceStaff, isActive: true })
      .select('_id fullName role')
      .sort({ fullName: 1, _id: 1 })
      .lean();
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        displayName: row.fullName,
        role: row.role,
      })),
    };
  }

  async intakeCatalog(user: AuthUser) {
    this.intakeActor(user);
    return this.catalogRows();
  }

  async catalog(user: AuthUser) {
    this.customer(user);
    return this.catalogRows();
  }

  private async catalogRows() {
    const rows = await this.services
      .find({ isActive: true })
      .sort({ name: 1, _id: 1 })
      .exec();
    return {
      items: rows
        .filter(
          (row) =>
            row.billable === false ||
            (typeof row.price === 'number' &&
              Number.isSafeInteger(row.price) &&
              row.price >= 0),
        )
        .map((row) => ({
          id: String(row._id),
          name: row.name,
          imageUrl: row.imageUrl,
          description: row.description ?? '',
          unit: row.unit ?? '',
          billable: row.billable,
          unitPriceVND: row.billable === false ? 0 : row.price,
        })),
    };
  }
}
