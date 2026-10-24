import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room } from './schemas/room.schema.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import { ListRoomsQuery } from './dto/list-rooms.dto.js';
import type { RoomListResponse } from './dto/room-response.dto.js';
import { CreateRoomDto, UpdateRoomDto } from './dto/write-room.dto.js';

type PopulatedRoom = Omit<Room, 'roomType'> & {
  _id: Types.ObjectId;
  roomType: { _id: Types.ObjectId; name: string; isActive: boolean } | null;
};

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);
  constructor(
    @InjectModel(Room.name) private readonly rooms: Model<Room>,
    @InjectModel(RoomType.name) private readonly roomTypes: Model<RoomType>,
  ) {}

  private validateId(id: string) {
    if (!/^[0-9a-f]{24}$/.test(id))
      throw new BadRequestException('Room id không hợp lệ');
  }
  private async validType(id: string) {
    if (
      !/^[0-9a-f]{24}$/.test(id) ||
      !(await this.roomTypes.exists({ _id: id, isActive: true }))
    )
      throw new BadRequestException(
        'Loại phòng không hợp lệ hoặc đã ngừng; hãy chọn loại phòng còn hoạt động',
      );
  }
  private async uniqueNumber(roomNumber: string, except?: string) {
    if (
      await this.rooms.exists({
        roomNumber,
        ...(except ? { _id: { $ne: except } } : {}),
      })
    )
      throw new ConflictException('Số phòng đã tồn tại');
  }
  private duplicate(error: unknown): never {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    )
      throw new ConflictException('Số phòng đã tồn tại');
    throw error;
  }
  private response(row: PopulatedRoom) {
    if (!row.roomType)
      this.logger.warn(`Room ${row._id} has a missing RoomType reference`);
    return {
      id: String(row._id),
      roomNumber: row.roomNumber,
      floor: row.floor,
      roomType: row.roomType
        ? {
            id: String(row.roomType._id),
            name: row.roomType.name,
            isActive: row.roomType.isActive,
          }
        : null,
      status: row.status,
      notes: row.notes ?? '',
      isActive: row.isActive,
    };
  }
  async detail(id: string) {
    this.validateId(id);
    const row = await this.rooms
      .findById(id)
      .populate<{ roomType: PopulatedRoom['roomType'] }>(
        'roomType',
        'name isActive',
      )
      .lean()
      .exec();
    if (!row) throw new NotFoundException('Không tìm thấy phòng');
    return this.response(row);
  }
  async create(dto: CreateRoomDto) {
    if (!(await this.roomTypes.exists({ isActive: true })))
      throw new BadRequestException(
        'Chưa có loại phòng hoạt động; hãy tạo hoặc kích hoạt loại phòng trước',
      );
    await this.validType(dto.roomType);
    await this.uniqueNumber(dto.roomNumber);
    try {
      const created = await this.rooms.create(dto);
      return await this.detail(String(created._id));
    } catch (error) {
      this.duplicate(error);
    }
  }
  async update(id: string, dto: UpdateRoomDto) {
    this.validateId(id);
    if (!Object.keys(dto).length)
      throw new BadRequestException('Cần ít nhất một trường cập nhật');
    if (dto.roomNumber !== undefined)
      await this.uniqueNumber(dto.roomNumber, id);
    // Compare the validated Room snapshot in the atomic write; retry if another writer changes it.
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await this.rooms.findById(id).lean().exec();
      if (!current) throw new NotFoundException('Không tìm thấy phòng');
      const type = dto.roomType ?? String(current.roomType);
      if (
        (dto.roomType !== undefined &&
          dto.roomType !== String(current.roomType)) ||
        (dto.isActive === true && !current.isActive)
      )
        await this.validType(type);
      try {
        const updated = await this.rooms
          .findOneAndUpdate(
            { _id: id, roomType: current.roomType, isActive: current.isActive },
            { $set: dto },
            { returnDocument: 'after', runValidators: true },
          )
          .populate<{ roomType: PopulatedRoom['roomType'] }>(
            'roomType',
            'name isActive',
          )
          .lean()
          .exec();
        if (updated) return this.response(updated);
      } catch (error) {
        this.duplicate(error);
      }
    }
    throw new ConflictException('Phòng vừa thay đổi, vui lòng thử lại');
  }
  async list(query: ListRoomsQuery): Promise<RoomListResponse> {
    const filter = {
      ...(query.search
        ? {
            roomNumber: {
              $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
      ...(query.roomTypeId
        ? { roomType: new Types.ObjectId(query.roomTypeId) }
        : {}),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.floor === undefined ? {} : { floor: query.floor }),
    };
    const collation = { locale: 'en', numericOrdering: true };
    const [rows, total] = await Promise.all([
      this.rooms
        .find(filter)
        .collation(collation)
        .sort({ [query.sortBy]: query.sortOrder === 'desc' ? -1 : 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate<{ roomType: PopulatedRoom['roomType'] }>(
          'roomType',
          'name isActive',
        )
        .lean()
        .exec(),
      this.rooms.countDocuments(filter).collation(collation).exec(),
    ]);
    return {
      items: rows.map((row) => this.response(row)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
