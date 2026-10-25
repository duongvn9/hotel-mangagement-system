import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'node:crypto';
import type { Seed } from '../../database/seed.js';
import { Role } from '../../common/constants/role.enum.js';
import { User } from '../users/schemas/user.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { Equipment } from '../equipment/schemas/equipment.schema.js';
import { Maintenance } from './schemas/maintenance.schema.js';

export const MAINTENANCE_HISTORY_SAMPLES = [
  {
    key: '713bba10-3ab0-4aca-a400-000000000001',
    roomNumber: '102',
    assetCode: 'AC-102',
    description:
      'Ghi nhận tiếng ồn nhẹ khi kiểm tra điều hòa; theo dõi trong ca tiếp theo.',
  },
  {
    key: '713bba10-3ab0-4aca-a400-000000000002',
    assetCode: 'LIFT-01',
    description: 'Ghi nhận vết xước vỏ thang máy, không ảnh hưởng vận hành.',
  },
  {
    key: '713bba10-3ab0-4aca-a400-000000000003',
    facilityLocation: 'Sảnh chính',
    description: 'Ghi nhận sơn tróc tại chân tường sảnh.',
  },
];
/** Historical observations only: never bypass TasksService to seed maintenance work. */
export const seedMaintenance: Seed = async (app) => {
  const reports = app.get<Model<Maintenance>>(getModelToken(Maintenance.name));
  const users = app.get<Model<User>>(getModelToken(User.name));
  const rooms = app.get<Model<Room>>(getModelToken(Room.name));
  const equipment = app.get<Model<Equipment>>(getModelToken(Equipment.name));
  const actor = await users
    .findOne({
      email: 'operations@hms.local',
      role: Role.OperationsStaff,
      isActive: true,
    })
    .lean();
  if (!actor) return;
  await reports.init();
  for (const sample of MAINTENANCE_HISTORY_SAMPLES) {
    const room = sample.roomNumber
      ? await rooms.findOne({ roomNumber: sample.roomNumber }).lean()
      : null;
    const device = sample.assetCode
      ? await equipment.findOne({ assetCode: sample.assetCode }).lean()
      : null;
    if ((sample.roomNumber && !room) || (sample.assetCode && !device)) continue;
    const now = new Date();
    await reports.updateOne(
      { reportedBy: actor._id, requestKey: sample.key },
      {
        $setOnInsert: {
          reportedBy: actor._id,
          requestKey: sample.key,
          requestFingerprint: createHash('sha256')
            .update(`UC36-SEED:${sample.key}`)
            .digest('hex'),
          description: sample.description,
          requiresAction: false,
          preventsSafeUse: false,
          ...(room
            ? { room: room._id }
            : device?.room
              ? { room: new Types.ObjectId(String(device.room)) }
              : {}),
          ...(device ? { equipment: device._id } : {}),
          ...(sample.facilityLocation
            ? { facilityLocation: sample.facilityLocation }
            : {}),
          receipt: { roomMarkedUnavailable: false, warnings: [] },
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, timestamps: false },
    );
  }
};
