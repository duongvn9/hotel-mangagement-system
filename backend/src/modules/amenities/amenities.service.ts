import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Amenity } from './schemas/amenity.schema.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import { ListAmenitiesQuery } from './dto/list-amenities.dto.js';
import { CreateAmenityDto, UpdateAmenityDto } from './dto/write-amenity.dto.js';
import type {
  AmenityListResponse,
  AmenityResponse,
  AmenityRoomTypeResponse,
} from './dto/amenity-response.dto.js';

@Injectable()
export class AmenitiesService {
  private readonly logger = new Logger(AmenitiesService.name);
  constructor(
    @InjectModel(Amenity.name) private readonly amenities: Model<Amenity>,
    @InjectModel(RoomType.name) private readonly roomTypes: Model<RoomType>,
  ) {}

  private validateId(id: string) {
    if (!/^[0-9a-f]{24}$/.test(id))
      throw new BadRequestException('Amenity id không hợp lệ');
  }

  private validateIds(ids: string[]) {
    if (
      !Array.isArray(ids) ||
      ids.some((id) => typeof id !== 'string' || !/^[0-9a-f]{24}$/.test(id)) ||
      new Set(ids).size !== ids.length
    )
      throw new BadRequestException(
        'roomTypeIds phải là mảng ObjectId canonical không trùng',
      );
  }

  private async uniqueName(name: string, except?: string) {
    if (
      await this.amenities.exists({
        name,
        ...(except ? { _id: { $ne: except } } : {}),
      })
    )
      throw new ConflictException('Tên tiện nghi đã tồn tại');
  }

  private duplicate(error: unknown): never {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    )
      throw new ConflictException('Tên tiện nghi đã tồn tại');
    throw error;
  }

  private assigned(id: string) {
    return this.roomTypes
      .find({ amenities: new Types.ObjectId(id) })
      .select('name isActive')
      .sort({ name: 1, _id: 1 })
      .lean()
      .exec();
  }

  private async validateAssignments(added: string[], active: boolean) {
    if (!added.length) return;
    if (!active)
      throw new BadRequestException(
        'Tiện nghi ngừng không thể gắn mới Room Type; hãy bật lại trước',
      );
    const rows = await this.roomTypes
      .find({ _id: { $in: added }, isActive: true })
      .select('_id')
      .lean()
      .exec();
    const found = new Set(rows.map((row) => String(row._id)));
    const invalid = added.filter((id) => !found.has(id));
    if (invalid.length)
      throw new BadRequestException(
        `Room Type không hợp lệ hoặc đã ngừng: ${invalid.join(', ')}`,
      );
  }

  private async writeAssignments(
    id: string,
    added: string[],
    removed: string[],
  ) {
    const amenity = new Types.ObjectId(id);
    const operations = [
      ...added.map((type) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(type), isActive: true },
          update: { $addToSet: { amenities: amenity } },
        },
      })),
      ...removed.map((type) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(type) },
          update: { $pull: { amenities: amenity } },
        },
      })),
    ];
    if (!operations.length) return;
    const result = await this.roomTypes.bulkWrite(operations, {
      ordered: false,
    });
    if (result.matchedCount !== operations.length)
      throw new Error('RoomType set changed during write');
  }

  async detail(id: string): Promise<AmenityResponse> {
    this.validateId(id);
    const row = await this.amenities.findById(id).lean().exec();
    if (!row) throw new NotFoundException('Không tìm thấy tiện nghi');
    const types = await this.assigned(id);
    const roomTypes = types.map((type) => ({
      id: String(type._id),
      name: type.name,
      isActive: type.isActive,
    }));
    return {
      id: String(row._id),
      name: row.name,
      iconUrl: row.iconUrl,
      images: row.images?.length
        ? row.images
        : row.iconUrl
          ? [row.iconUrl]
          : [],
      description: row.description ?? '',
      isActive: row.isActive,
      roomTypes,
      roomTypeCount: roomTypes.length,
    };
  }

  async create(dto: CreateAmenityDto) {
    const { roomTypeIds = [], ...fields } = dto;
    if (fields.images !== undefined) fields.iconUrl = fields.images[0] ?? '';
    else if (fields.iconUrl !== undefined) fields.images = [fields.iconUrl];
    this.validateIds(roomTypeIds);
    await this.uniqueName(fields.name);
    await this.validateAssignments(roomTypeIds, fields.isActive ?? true);
    const created = await this.amenities
      .create({
        ...fields,
        description: fields.description ?? '',
        isActive: fields.isActive ?? true,
      })
      .catch((error: unknown) => this.duplicate(error));
    const id = String(created._id);
    try {
      await this.writeAssignments(id, roomTypeIds, []);
    } catch (error) {
      this.logger.error(
        `Assignment creation failed for Amenity ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      try {
        // Pull first: if cleanup fails, retain the record rather than orphaning RoomType refs.
        await this.roomTypes.updateMany(
          { amenities: new Types.ObjectId(id) },
          { $pull: { amenities: new Types.ObjectId(id) } },
        );
        await this.amenities.deleteOne({ _id: id });
      } catch (cleanupError) {
        this.logger.error(
          `Compensation incomplete for Amenity ${id}`,
          cleanupError instanceof Error
            ? cleanupError.stack
            : String(cleanupError),
        );
        throw new ServiceUnavailableException(
          `Bù trừ chưa hoàn tất cho tiện nghi ${id}; cần kiểm tra dữ liệu trước khi thử tạo lại`,
        );
      }
      throw new ServiceUnavailableException(
        'Không thể tạo gắn kết; đã hoàn tác tiện nghi vừa tạo. Vui lòng thử lại',
      );
    }
    return this.detail(id);
  }

  async update(id: string, dto: UpdateAmenityDto) {
    this.validateId(id);
    const defined = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateAmenityDto;
    if (!Object.keys(defined).length)
      throw new BadRequestException('Cần ít nhất một trường cập nhật');
    if (defined.roomTypeIds !== undefined)
      this.validateIds(defined.roomTypeIds);
    const current = await this.amenities.findById(id).lean().exec();
    if (!current) throw new NotFoundException('Không tìm thấy tiện nghi');
    if (defined.name !== undefined) await this.uniqueName(defined.name, id);
    let added: string[] = [];
    let removed: string[] = [];
    if (defined.roomTypeIds !== undefined) {
      const existing = (await this.assigned(id)).map((type) =>
        String(type._id),
      );
      added = defined.roomTypeIds.filter((type) => !existing.includes(type));
      removed = existing.filter((type) => !defined.roomTypeIds!.includes(type));
      await this.validateAssignments(
        added,
        defined.isActive ?? current.isActive,
      );
    }
    const { roomTypeIds: _target, ...fields } = defined;
    if (fields.images !== undefined) fields.iconUrl = fields.images[0] ?? '';
    else if (fields.iconUrl !== undefined) fields.images = [fields.iconUrl];
    if (Object.keys(fields).length) {
      try {
        const updated = await this.amenities
          .findOneAndUpdate(
            { _id: id, isActive: current.isActive },
            { $set: fields },
            { returnDocument: 'after', runValidators: true },
          )
          .lean()
          .exec();
        if (!updated)
          throw new ConflictException(
            'Tiện nghi vừa thay đổi, vui lòng thử lại',
          );
      } catch (error) {
        this.duplicate(error);
      }
    }
    try {
      await this.writeAssignments(id, added, removed);
    } catch (error) {
      this.logger.error(
        `Assignment update incomplete for Amenity ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Lưu gắn kết chưa hoàn tất; thông tin tiện nghi có thể đã được lưu. Vui lòng gửi lại cùng yêu cầu để hoàn tất',
      );
    }
    return this.detail(id);
  }

  async list(query: ListAmenitiesQuery): Promise<AmenityListResponse> {
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
      this.amenities
        .find(filter)
        .sort({ [query.sortBy]: query.sortOrder === 'desc' ? -1 : 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.amenities.countDocuments(filter).exec(),
    ]);
    const groups = new Map<string, AmenityRoomTypeResponse[]>(
      rows.map((row) => [String(row._id), []]),
    );
    if (rows.length) {
      const types = await this.roomTypes
        .find({ amenities: { $in: rows.map((row) => row._id) } })
        .select('name isActive amenities')
        .sort({ name: 1, _id: 1 })
        .lean()
        .exec();
      for (const type of types) {
        for (const id of new Set((type.amenities ?? []).map(String))) {
          groups.get(id)?.push({
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
          iconUrl: row.iconUrl,
          images: row.images?.length
            ? row.images
            : row.iconUrl
              ? [row.iconUrl]
              : [],
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

  async options() {
    const rows = await this.amenities
      .find({ isActive: true })
      .sort({ name: 1, _id: 1 })
      .lean()
      .exec();
    return rows.map((row) => ({ id: String(row._id), name: row.name }));
  }

  async validateNew(ids: string[], retained: string[] = []) {
    const added = ids.filter((id) => !retained.includes(id));
    if (!added.length) return;
    const rows = await this.amenities
      .find({ _id: { $in: added }, isActive: true })
      .select('_id')
      .lean()
      .exec();
    const found = new Set(rows.map((row) => String(row._id)));
    const invalid = added.filter((id) => !found.has(id));
    if (invalid.length)
      throw new BadRequestException(
        `amenities không hợp lệ: ${invalid.join(', ')}`,
      );
  }
}
