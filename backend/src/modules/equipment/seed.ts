import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { Equipment } from './schemas/equipment.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { EquipmentCondition } from '../../common/constants/equipment-condition.enum.js';

export const EQUIPMENT_SEED_SAMPLES = [
  {
    assetCode: 'AC-102',
    name: 'Điều hòa phòng 102',
    category: 'Điều hòa',
    location: 'Phòng 102',
    roomNumber: '102',
  },
  {
    assetCode: 'TV-102',
    name: 'TV phòng 102',
    category: 'Điện tử',
    location: 'Phòng 102',
    roomNumber: '102',
  },
  {
    assetCode: 'SAFE-201',
    name: 'Két sắt phòng 201',
    category: 'An ninh',
    location: 'Phòng 201',
    roomNumber: '201',
  },
  {
    assetCode: 'HEATER-301',
    name: 'Bình nóng lạnh phòng 301',
    category: 'Điện nước',
    location: 'Phòng 301',
    roomNumber: '301',
  },
  {
    assetCode: 'LIFT-01',
    name: 'Thang máy',
    category: 'Thang máy',
    location: 'Sảnh chính',
  },
  {
    assetCode: 'GEN-01',
    name: 'Máy phát điện',
    category: 'Điện',
    location: 'Tầng kỹ thuật',
  },
  {
    assetCode: 'PUMP-OLD',
    name: 'Bơm nước dự phòng',
    category: 'Điện nước',
    location: 'Phòng bơm',
    isActive: false,
  },
];
export const seedEquipment: Seed = async (app) => {
  const equipment = app.get<Model<Equipment>>(getModelToken(Equipment.name));
  const rooms = app.get<Model<Room>>(getModelToken(Room.name));
  await equipment.init();
  for (const { roomNumber, ...sample } of EQUIPMENT_SEED_SAMPLES) {
    const room = roomNumber ? await rooms.findOne({ roomNumber }).lean() : null;
    if (roomNumber && !room) continue;
    const now = new Date();
    await equipment.updateOne(
      { assetCode: sample.assetCode },
      {
        $setOnInsert: {
          ...sample,
          ...(room ? { room: room._id } : {}),
          condition: EquipmentCondition.Good,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, timestamps: false },
    );
  }
};
