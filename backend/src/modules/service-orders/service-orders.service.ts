import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema.js';
import { Service } from '../services/schemas/service.schema.js';
import {
  CreateServiceOrderDto,
  ListServiceOrdersQuery,
} from './dto/service-order.dto.js';
import {
  ServiceOrder,
  type ServiceOrderDocument,
} from './schemas/service-order.schema.js';

@Injectable()
export class ServiceOrdersService implements OnModuleInit {
  constructor(
    @InjectModel(ServiceOrder.name)
    private readonly orders: Model<ServiceOrder>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(Service.name) private readonly services: Model<Service>,
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

  private async ownedBooking(
    booking: Types.ObjectId,
    customer: Types.ObjectId,
    active = false,
  ) {
    const row = await this.bookings.findOne({ _id: booking, customer }).exec();
    if (!row) throw new NotFoundException('Booking not found');
    if (active && (!row.isActive || row.status !== BookingStatus.CheckedIn))
      throw new ConflictException('Booking must be active and CHECKED_IN');
    return row;
  }

  private response(row: ServiceOrderDocument) {
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
    await this.ownedBooking(row.booking, customer, true);
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
    await this.ownedBooking(booking, customer, true);
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
      items: rows.map((row) => this.response(row)),
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

  async orderContexts(user: AuthUser) {
    const customer = this.customer(user);
    const rows = await this.bookings
      .find({ customer, isActive: true, status: BookingStatus.CheckedIn })
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
          description: row.description ?? '',
          unit: row.unit ?? '',
          billable: row.billable,
          unitPriceVND: row.billable === false ? 0 : row.price,
        })),
    };
  }
}
