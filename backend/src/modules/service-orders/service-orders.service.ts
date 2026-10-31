import { createHash } from 'node:crypto';
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
      { customer: 1, requestId: 1 },
      {
        unique: true,
        partialFilterExpression: { requestId: { $exists: true } },
      },
    );
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

  private async response(row: ServiceOrderDocument) {
    await this.executionTask(row);
    return {
      id: String(row._id),
      bookingId: String(row.booking),
      serviceId: String(row.service),
      service: { name: row.serviceName, unit: row.unit },
      quantity: row.quantity,
      unitPriceVND: row.unitPriceVND,
      amount: row.amount,
      requestedTime: row.requestedTime,
      reviewStatus: row.reviewStatus,
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
      .select('+requestFingerprint')
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
    await this.ownedBooking(booking, customer, 'orderable');
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
      const requestId = `booking:${bookingId}:service:${String(selection.service)}`;
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
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.orders.countDocuments(filter).exec(),
    ]);
    return {
      items: await Promise.all(rows.map((row) => this.response(row))),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string, user: AuthUser) {
    const customer = this.customer(user);
    const row = await this.orders
      .findOne({ _id: this.id(id), customer })
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
    '+reviewedBy +reviewedAt +reviewDecision +reviewReason +billedInvoiceId +billedAt +assignmentAssignee +assignmentDueAt';

  private async staffResponse(row: ServiceOrderDocument) {
    const [booking, customer] = await Promise.all([
      this.bookings
        .findById(row.booking)
        .select('code status checkIn checkOut')
        .exec(),
      row.customer
        ? this.users.findById(row.customer).select('fullName').exec()
        : null,
    ]);
    return {
      ...(await this.response(row)),
      task: await this.taskSummary(row),
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
          }
        : null,
      feeRequired: row.amount > 0,
      billingStatus:
        row.billedInvoiceId && row.billedAt
          ? 'BILLED'
          : row.amount > 0 && row.reviewDecision === 'ACCEPT'
            ? 'PENDING'
            : 'NOT_REQUIRED',
      ...(row.reviewDecision
        ? {
            review: {
              decision: row.reviewDecision,
              reason: row.reviewReason ?? '',
              reviewedBy: String(row.reviewedBy),
              reviewedAt: row.reviewedAt,
            },
          }
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
    return {
      items: await Promise.all(rows.map((row) => this.staffResponse(row))),
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
      return await this.reviewOrder(id, dto, user);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Review temporarily unavailable; retry the same review',
      );
    }
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
    if (row.reviewStatus === ServiceOrderReviewStatus.PendingReview) {
      this.validateAmount(row);
      if (dto.decision === 'ACCEPT')
        await this.ownedBooking(row.booking, row.customer, 'in-house');
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
    )
      return this.staffResponse(row);
    if (row.reviewStatus !== ServiceOrderReviewStatus.Accepting)
      throw new ConflictException('Service order is no longer pending');
    this.validateAmount(row);
    try {
      let invoice: InvoiceDocument | undefined;
      if (row.amount > 0) {
        invoice = await this.invoices.getOrCreateForBooking(
          String(row.booking),
        );
        if (!this.matchingCharge(invoice, row)) {
          await this.ownedBooking(row.booking, row.customer, 'in-house');
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
    '+assignmentAssignee +assignmentRequestedBy +assignmentRequestedAt +assignmentDueAt +assignmentTitle';

  private async assignmentOrder(id: string) {
    const row = await this.orders
      .findById(this.id(id))
      .select(`${this.staffSelection} ${this.assignmentSelection}`)
      .exec();
    if (!row) throw new NotFoundException('Service order not found');
    return row;
  }

  private async assertAssignable(row: ServiceOrderDocument) {
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
    if (
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
    return {
      items: items.map((staff) => ({
        id: String(staff._id),
        displayName: staff.fullName,
        role: staff.role,
      })),
    };
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
    let row = await this.assignmentOrder(id);
    await this.assertAssignable(row);
    if (row.executionStatus === ServiceOrderExecutionStatus.NotStarted) {
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
    if (row.executionStatus !== ServiceOrderExecutionStatus.Assigning)
      throw new ConflictException(
        'Assignment already finalized; reload service order',
      );
    if (
      String(row.assignmentAssignee) !== String(assigneeId) ||
      row.assignmentDueAt?.getTime() !== dueAt?.getTime()
    )
      throw new ConflictException(
        'A different assignment intent is already pending',
      );
    if (
      !row.assignmentTaskId ||
      !row.assignmentTitle ||
      !row.assignmentRequestedAt
    )
      throw new ConflictException('Assignment intent is incomplete');
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
      if (
        String(task.assignedTo) !== String(row.assignmentAssignee) ||
        task.dueAt?.getTime() !== row.assignmentDueAt?.getTime() ||
        task.title !== row.assignmentTitle ||
        task.priority !== 'NORMAL' ||
        task.assignedAt.getTime() !== row.assignmentRequestedAt.getTime()
      )
        throw new ConflictException(
          'Existing source work does not match assignment intent',
        );
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
      if (!finalized)
        throw new ConflictException(
          'Assignment already finalized; reload service order',
        );
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
    return task
      ? { ...this.taskResponse(task), assigneeId: String(task.assignedTo) }
      : null;
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
    const result = await this.tasks.listCompletedServiceWork(
      user.id,
      query,
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
      .select('_id code checkIn checkOut')
      .sort({ checkIn: -1, _id: 1 })
      .exec();
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        code: row.code,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
      })),
    };
  }

  async catalog(user: AuthUser) {
    this.customer(user);
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
