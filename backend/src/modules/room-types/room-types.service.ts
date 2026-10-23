import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ListRoomTypesQuery } from './dto/list-room-types.dto.js';
import type { RoomTypeListResponse } from './dto/room-type-response.dto.js';
import {
  RoomType,
  validBasePrice,
  validAdultCapacity,
  validChildCapacity,
} from './schemas/room-type.schema.js';
import { AmenitiesService } from '../amenities/amenities.service.js';
import {
  CreateRoomTypeDto,
  UpdateRoomTypeDto,
} from './dto/write-room-type.dto.js';

@Injectable()
export class RoomTypesService {
  constructor(
    @InjectModel(RoomType.name) private readonly roomTypes: Model<RoomType>,
    private readonly amenities: AmenitiesService,
  ) {}

  private validateId(id: string) {
    if (!/^[0-9a-f]{24}$/.test(id))
      throw new BadRequestException('Room type id không hợp lệ');
  }

  private async uniqueName(name: string, except?: string) {
    const duplicate = await this.roomTypes.exists({
      name,
      ...(except ? { _id: { $ne: except } } : {}),
    });
    if (duplicate) throw new ConflictException('Tên loại phòng đã tồn tại');
  }

  private duplicate(error: unknown): never {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    )
      throw new ConflictException('Tên loại phòng đã tồn tại');
    throw error;
  }

  private validBookingFields(value: {
    isActive: boolean;
    adultCapacity: number;
    childCapacity: number;
    basePrice: number;
  }) {
    if (
      value.isActive &&
      (!validAdultCapacity(value.adultCapacity) ||
        !validChildCapacity(value.childCapacity) ||
        !validBasePrice(value.basePrice))
    )
      throw new BadRequestException(
        'adultCapacity, childCapacity và basePrice phải là số nguyên hợp lệ trước khi kích hoạt',
      );
  }

  async detail(id: string) {
    this.validateId(id);
    const row = await this.roomTypes
      .findById(id)
      .populate<{
        amenities: { _id: Types.ObjectId; name: string; isActive: boolean }[];
      }>('amenities', 'name isActive')
      .lean()
      .exec();
    if (!row) throw new NotFoundException('Không tìm thấy loại phòng');
    return this.response(row);
  }

  private response(row: {
    _id: Types.ObjectId;
    name: string;
    description?: string;
    adultCapacity: number;
    childCapacity: number;
    basePrice: number;
    isActive: boolean;
    amenities: { _id: Types.ObjectId; name: string; isActive?: boolean }[];
  }) {
    return {
      id: String(row._id),
      name: row.name,
      description: row.description ?? '',
      adultCapacity: row.adultCapacity,
      childCapacity: row.childCapacity,
      basePrice: row.basePrice,
      isActive: row.isActive,
      amenities: (row.amenities ?? []).filter(Boolean).map((a) => ({
        id: String(a._id),
        name: a.name,
        isActive: a.isActive,
      })),
      availableForBooking:
        row.isActive === true &&
        validAdultCapacity(row.adultCapacity) &&
        validChildCapacity(row.childCapacity) &&
        validBasePrice(row.basePrice),
    };
  }

  async create(dto: CreateRoomTypeDto) {
    const value = {
      ...dto,
      amenities: dto.amenities ?? [],
      isActive: dto.isActive ?? true,
    };
    this.validBookingFields(value);
    await this.uniqueName(value.name);
    await this.amenities.validateNew(value.amenities);
    try {
      const created = await this.roomTypes.create(value);
      return await this.detail(String(created._id));
    } catch (error) {
      this.duplicate(error);
    }
  }

  async update(id: string, dto: UpdateRoomTypeDto) {
    this.validateId(id);
    if (!Object.keys(dto).length)
      throw new BadRequestException('Cần ít nhất một trường cập nhật');
    if (dto.name !== undefined) await this.uniqueName(dto.name, id);
    // Compare the validated snapshot in the atomic write, retrying if another writer changed it.
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await this.roomTypes.findById(id).lean().exec();
      if (!current) throw new NotFoundException('Không tìm thấy loại phòng');
      this.validBookingFields({ ...current, ...dto });
      if (dto.amenities !== undefined)
        await this.amenities.validateNew(
          dto.amenities,
          current.amenities.map(String),
        );
      try {
        const updated = await this.roomTypes
          .findOneAndUpdate(
            {
              _id: id,
              adultCapacity: current.adultCapacity,
              childCapacity: current.childCapacity,
              basePrice: current.basePrice,
              isActive: current.isActive,
              amenities: current.amenities,
            },
            { $set: dto },
            { new: true, runValidators: true },
          )
          .populate<{
            amenities: {
              _id: Types.ObjectId;
              name: string;
              isActive: boolean;
            }[];
          }>('amenities', 'name isActive')
          .lean()
          .exec();
        if (updated) return this.response(updated);
      } catch (error) {
        this.duplicate(error);
      }
    }
    throw new ConflictException('Loại phòng vừa thay đổi, vui lòng thử lại');
  }

  async list(query: ListRoomTypesQuery): Promise<RoomTypeListResponse> {
    const { page, limit, sortBy, sortOrder } = query;
    const filter = {
      ...(query.search
        ? {
            name: {
              $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [rows, total] = await Promise.all([
      this.roomTypes
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate<{ amenities: { _id: Types.ObjectId; name: string }[] }>(
          'amenities',
          'name',
        )
        .lean()
        .exec(),
      this.roomTypes.countDocuments(filter).exec(),
    ]);
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        name: row.name,
        description: row.description ?? '',
        adultCapacity: row.adultCapacity,
        childCapacity: row.childCapacity,
        basePrice: row.basePrice,
        amenities: (row.amenities ?? [])
          .filter(Boolean)
          .map((amenity) => ({ id: String(amenity._id), name: amenity.name })),
        isActive: row.isActive,
        availableForBooking:
          row.isActive === true &&
          validAdultCapacity(row.adultCapacity) &&
          validChildCapacity(row.childCapacity) &&
          validBasePrice(row.basePrice),
      })),
      total,
      page,
      limit,
    };
  }
}
