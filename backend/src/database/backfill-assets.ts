import type { Connection } from 'mongoose';
import { SEED_ASSETS } from './seed-assets.js';

/** Native updates preserve timestamps and only fill absent seed images, atomically. */
export async function backfillAssets(connection: Connection) {
  const groups = [
    ['room-types', 'roomtypes', 'name', 'images'],
    ['services', 'services', 'name', 'imageUrl'],
    ['amenities', 'amenities', 'name', 'iconUrl'],
    ['equipment', 'equipment', 'assetCode', 'imageUrl'],
  ] as const;
  const results = [];
  for (const [group, collection, key, field] of groups) {
    const model = connection.collection(collection);
    let matched = 0;
    let updated = 0;
    const missing: string[] = [];
    for (const [value, image] of Object.entries(SEED_ASSETS[group])) {
      const identity = { [key]: value };
      matched += await model.countDocuments(identity);
      if (!(await model.findOne(identity, { projection: { _id: 1 } }))) {
        missing.push(value);
        continue;
      }
      const result = await model.updateOne(
        {
          ...identity,
          $or: [
            { [field]: { $exists: false } },
            // Expression equality compares the whole value: an array containing
            // a custom image and null/'' must never match a scalar null/''.
            { $expr: { $in: [`$${field}`, [null, '', []]] } },
          ],
        },
        { $set: { [field]: image } },
        { upsert: false },
      );
      updated += result.modifiedCount;
    }
    results.push({
      group,
      matched,
      updated,
      missing: missing.join(', ') || '-',
    });
  }
  console.table(results);
  return results;
}
