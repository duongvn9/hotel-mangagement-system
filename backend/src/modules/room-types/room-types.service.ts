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
import { BedTypesService } from '../bed-types/bed-types.service.js';
import {
  CreateRoomTypeDto,
  RoomTypeBedDto,
  UpdateRoomTypeDto,
} from './dto/write-room-type.dto.js';

/** Một phần tử giường sau khi populate BedType để dựng response. */
type PopulatedBed = {
  bedType: { _id: Types.ObjectId; name: string; isActive?: boolean } | null;
  quantity: number;
};

@Injectable()
export class RoomTypesService {
  constructor(
    @InjectModel(RoomType.name) private readonly roomTypes: Model<RoomType>,
    private readonly amenities: AmenitiesService,
    private readonly bedTypes: BedTypesService,
  ) {}

  private validateId(id: string) {
    if (!/^[0-9a-f]{24}$/.test(id))
      throw new BadRequestException('Room type id không hợp lệ');
  }

  /** Ánh xạ DTO giường (bedTypeId) sang shape lưu trữ (bedType ObjectId). */
  private toStoredBeds(beds: RoomTypeBedDto[]) {
    return beds.map((bed) => ({
      bedType: new Types.ObjectId(bed.bedTypeId),
      quantity: bed.quantity,
    }));
  }

  private mapBeds(beds?: PopulatedBed[]) {
    return (beds ?? [])
      .filter(
        (
          bed,
        ): bed is PopulatedBed & {
          bedType: NonNullable<PopulatedBed['bedType']>;
        } => Boolean(bed?.bedType),
      )
      .map((bed) => ({
        bedTypeId: String(bed.bedType._id),
        bedTypeName: bed.bedType.name,
        quantity: bed.quantity,
      }));
  }

  async options() {
    const rows = await this.roomTypes
      .find({ isActive: true })
      .select('name')
      .sort({ name: 1, _id: 1 })
      .lean()
      .exec();
    return rows.map((row) => ({ id: String(row._id), name: row.name }));
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
        amenities: {
          _id: Types.ObjectId;
          name: string;
          iconUrl?: string;
          isActive: boolean;
        }[];
      }>('amenities', 'name isActive iconUrl')
      .populate<{ beds: PopulatedBed[] }>('beds.bedType', 'name isActive')
      .lean()
      .exec();
    if (!row) throw new NotFoundException('Không tìm thấy loại phòng');
    return this.response(row);
  }

  private response(row: {
    _id: Types.ObjectId;
    name: string;
    description?: string;
    images?: string[];
    adultCapacity: number;
    childCapacity: number;
    basePrice: number;
    isActive: boolean;
    amenities: {
      _id: Types.ObjectId;
      name: string;
      iconUrl?: string;
      isActive?: boolean;
    }[];
    beds?: PopulatedBed[];
  }) {
    return {
      id: String(row._id),
      name: row.name,
      description: row.description ?? '',
      images: row.images ?? [],
      adultCapacity: row.adultCapacity,
      childCapacity: row.childCapacity,
      basePrice: row.basePrice,
      isActive: row.isActive,
      amenities: (row.amenities ?? []).filter(Boolean).map((a) => ({
        id: String(a._id),
        name: a.name,
        iconUrl: a.iconUrl,
        isActive: a.isActive,
      })),
      beds: this.mapBeds(row.beds),
      availableForBooking:
        row.isActive === true &&
        validAdultCapacity(row.adultCapacity) &&
        validChildCapacity(row.childCapacity) &&
        validBasePrice(row.basePrice),
    };
  }

  async create(dto: CreateRoomTypeDto) {
    const beds = dto.beds ?? [];
    const value = {
      ...dto,
      amenities: dto.amenities ?? [],
      beds: this.toStoredBeds(beds),
      isActive: dto.isActive ?? true,
    };
    this.validBookingFields(value);
    await this.uniqueName(value.name);
    await this.amenities.validateNew(value.amenities);
    await this.bedTypes.validateNew(beds.map((bed) => bed.bedTypeId));
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
    // Store shape differs from the DTO (bedTypeId -> bedType ObjectId).
    const { beds, ...rest } = dto;
    const payload =
      beds === undefined ? rest : { ...rest, beds: this.toStoredBeds(beds) };
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
      if (beds !== undefined)
        await this.bedTypes.validateNew(
          beds.map((bed) => bed.bedTypeId),
          (current.beds ?? []).map((bed) => String(bed.bedType)),
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
            { $set: payload },
            { new: true, runValidators: true },
          )
          .populate<{
            amenities: {
              _id: Types.ObjectId;
              name: string;
              isActive: boolean;
            }[];
          }>('amenities', 'name isActive iconUrl')
          .populate<{ beds: PopulatedBed[] }>('beds.bedType', 'name isActive')
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
        .populate<{
          amenities: { _id: Types.ObjectId; name: string; iconUrl?: string }[];
        }>('amenities', 'name iconUrl')
        .populate<{ beds: PopulatedBed[] }>('beds.bedType', 'name isActive')
        .lean()
        .exec(),
      this.roomTypes.countDocuments(filter).exec(),
    ]);
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        name: row.name,
        description: row.description ?? '',
        images: row.images ?? [],
        adultCapacity: row.adultCapacity,
        childCapacity: row.childCapacity,
        basePrice: row.basePrice,
        amenities: (row.amenities ?? []).filter(Boolean).map((amenity) => ({
          id: String(amenity._id),
          name: amenity.name,
          iconUrl: amenity.iconUrl,
        })),
        beds: this.mapBeds(row.beds),
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
