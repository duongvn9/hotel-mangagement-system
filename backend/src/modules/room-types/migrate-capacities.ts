import type { Model } from 'mongoose';
import type { RoomType } from './schemas/room-type.schema.js';

/** Preserve existing split capacities and timestamps; never guess how to split legacy adults/children. */
export async function migrateRoomTypeCapacities(model: Model<RoomType>) {
  // Native collection access is intentional: capacity is no longer part of the schema.
  return model.collection.updateMany(
    {
      capacity: { $exists: true },
      adultCapacity: { $exists: false },
      childCapacity: { $exists: false },
    },
    [
      { $set: { adultCapacity: '$capacity', childCapacity: 0 } },
      { $unset: 'capacity' },
    ],
  );
}
