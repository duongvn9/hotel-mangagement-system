import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BedType } from './schemas/bed-type.schema.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import { ListBedTypesQuery } from './dto/list-bed-types.dto.js';
import {
  CreateBedTypeDto,
  UpdateBedTypeDto,
} from './dto/write-bed-type.dto.js';
import type {
  BedTypeListResponse,
  BedTypeResponse,
  BedTypeRoomTypeResponse,
} from './dto/bed-type-response.dto.js';

/** Một loại giường dùng RoomType tham chiếu qua `beds.bedType`; cấu hình giường sửa ở RoomType. */
@Injectable()
export class BedTypesService {
  constructor(
    @InjectModel(BedType.name) private readonly bedTypes: Model<BedType>,
    @InjectModel(RoomType.name) private readonly roomTypes: Model<RoomType>,
  ) {}

  private validateId(id: string) {
    if (!/^[0-9a-f]{24}$/.test(id))
      throw new BadRequestException('Bed type id không hợp lệ');
  }

  private async uniqueName(name: string, except?: string) {
    if (
      await this.bedTypes.exists({
        name,
        ...(except ? { _id: { $ne: except } } : {}),
      })
    )
      throw new ConflictException('Tên loại giường đã tồn tại');
  }

  private duplicate(error: unknown): never {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    )
      throw new ConflictException('Tên loại giường đã tồn tại');
    throw error;
  }

  /** Các RoomType đang dùng một loại giường, để hiển thị tham chiếu ngược (chỉ đọc). */
  private assigned(id: string) {
    return this.roomTypes
      .find({ 'beds.bedType': new Types.ObjectId(id) })
      .select('name isActive')
      .sort({ name: 1, _id: 1 })
      .lean()
      .exec();
  }

  async detail(id: string): Promise<BedTypeResponse> {
    this.validateId(id);
    const row = await this.bedTypes.findById(id).lean().exec();
    if (!row) throw new NotFoundException('Không tìm thấy loại giường');
    const roomTypes = (await this.assigned(id)).map((type) => ({
      id: String(type._id),
      name: type.name,
      isActive: type.isActive,
    }));
    return {
      id: String(row._id),
      name: row.name,
      description: row.description ?? '',
      isActive: row.isActive,
      roomTypes,
      roomTypeCount: roomTypes.length,
    };
  }

  async create(dto: CreateBedTypeDto): Promise<BedTypeResponse> {
    await this.uniqueName(dto.name);
    const created = await this.bedTypes
      .create({
        name: dto.name,
        description: dto.description ?? '',
        isActive: dto.isActive ?? true,
      })
      .catch((error: unknown) => this.duplicate(error));
    return this.detail(String(created._id));
  }

  async update(id: string, dto: UpdateBedTypeDto): Promise<BedTypeResponse> {
    this.validateId(id);
    const defined = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateBedTypeDto;
    if (!Object.keys(defined).length)
      throw new BadRequestException('Cần ít nhất một trường cập nhật');
    const current = await this.bedTypes.findById(id).lean().exec();
    if (!current) throw new NotFoundException('Không tìm thấy loại giường');
    if (defined.name !== undefined) await this.uniqueName(defined.name, id);
    try {
      const updated = await this.bedTypes
        .findOneAndUpdate(
          { _id: id },
          { $set: defined },
          { returnDocument: 'after', runValidators: true },
        )
        .lean()
        .exec();
      if (!updated)
        throw new ConflictException(
          'Loại giường vừa thay đổi, vui lòng thử lại',
        );
    } catch (error) {
      this.duplicate(error);
    }
    return this.detail(id);
  }

  async list(query: ListBedTypesQuery): Promise<BedTypeListResponse> {
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
      this.bedTypes
        .find(filter)
        .sort({ [query.sortBy]: query.sortOrder === 'desc' ? -1 : 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.bedTypes.countDocuments(filter).exec(),
    ]);
    const groups = new Map<string, BedTypeRoomTypeResponse[]>(
      rows.map((row) => [String(row._id), []]),
    );
    if (rows.length) {
      const types = await this.roomTypes
        .find({ 'beds.bedType': { $in: rows.map((row) => row._id) } })
        .select('name isActive beds')
        .sort({ name: 1, _id: 1 })
        .lean()
        .exec();
      for (const type of types) {
        const used = new Set(
          (type.beds ?? [])
            .map((bed) => bed?.bedType)
            .filter(Boolean)
            .map(String),
        );
        for (const bedTypeId of used) {
          groups.get(bedTypeId)?.push({
            id: String(type._id),
            name: type.name,
            isActive: type.isActive,
          });
        }
      }
    }
    return {
      items: rows.map((row) => {
        const roomTypes = groups.get(String(row._id))!;
        return {
          id: String(row._id),
          name: row.name,
          description: row.description ?? '',
          isActive: row.isActive,
          roomTypes,
          roomTypeCount: roomTypes.length,
        };
      }),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async options(): Promise<{ id: string; name: string }[]> {
    const rows = await this.bedTypes
      .find({ isActive: true })
      .sort({ name: 1, _id: 1 })
      .lean()
      .exec();
    return rows.map((row) => ({ id: String(row._id), name: row.name }));
  }

  /** Dùng cho form RoomType: các loại giường mới gắn vào phải tồn tại và còn hoạt động. */
  async validateNew(ids: string[], retained: string[] = []) {
    const added = ids.filter((id) => !retained.includes(id));
    if (!added.length) return;
    const rows = await this.bedTypes
      .find({ _id: { $in: added }, isActive: true })
      .select('_id')
      .lean()
      .exec();
    const found = new Set(rows.map((row) => String(row._id)));
    const invalid = added.filter((id) => !found.has(id));
    if (invalid.length)
      throw new BadRequestException(
        `Loại giường không hợp lệ hoặc đã ngừng: ${invalid.join(', ')}`,
      );
  }
}
