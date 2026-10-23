import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import { Room } from './schemas/room.schema.js';

export const seedRooms: Seed = async (app) => {
  const rooms = app.get<Model<Room>>(getModelToken(Room.name));
  const types = app.get<Model<RoomType>>(getModelToken(RoomType.name));
  // On a fresh DB the first active room matches seedBookings' CHECKED_IN example.
  const samples = [
    {
      roomNumber: '101',
      floor: 1,
      type: 'Standard',
      status: RoomStatus.Occupied,
      notes: 'Phòng cho booking CHECKED_IN mẫu.',
    },
    {
      roomNumber: '102',
      floor: 1,
      type: 'Standard',
      status: RoomStatus.Available,
    },
    {
      roomNumber: '201',
      floor: 2,
      type: 'Deluxe',
      status: RoomStatus.Cleaning,
      notes: 'Đang dọn phòng.',
    },
    {
      roomNumber: '202',
      floor: 2,
      type: 'Deluxe',
      status: RoomStatus.Maintenance,
      notes: 'Kiểm tra điều hòa.',
    },
    {
      roomNumber: '301',
      floor: 3,
      type: 'Suite',
      status: RoomStatus.Available,
    },
    {
      roomNumber: '302',
      floor: 3,
      type: 'Suite',
      status: RoomStatus.Maintenance,
      isActive: false,
      notes: 'Tạm ngừng sử dụng.',
    },
  ];
  for (const { type, ...sample } of samples) {
    const roomType = await types.findOne({ name: type }).lean();
    if (!roomType) throw new Error(`Seed rooms requires RoomType ${type}`);
    await rooms.updateOne(
      { roomNumber: sample.roomNumber },
      { $setOnInsert: { ...sample, roomType: roomType._id } },
      { upsert: true },
    );
  }
};
