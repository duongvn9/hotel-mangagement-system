import { describe, expect, it, vi } from 'vitest';
import type { Connection } from 'mongoose';
import { backfillAssets } from './backfill-assets.js';

describe('backfillAssets', () => {
  it('guards every write against existing images and changes only image fields', async () => {
    const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 0 });
    const collection = vi.fn().mockReturnValue({
      countDocuments: vi.fn().mockResolvedValue(1),
      findOne: vi.fn().mockResolvedValue({ _id: 'existing' }),
      updateOne,
    });
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    try {
      const results = await backfillAssets({
        collection,
      } as unknown as Connection);
      expect(updateOne).toHaveBeenCalledTimes(21);
      for (const [filter, update, options] of updateOne.mock.calls) {
        const field = Object.keys(update.$set)[0];
        expect(['images', 'imageUrl', 'iconUrl']).toContain(field);
        expect(Object.keys(update)).toEqual(['$set']);
        expect(Object.keys(update.$set)).toHaveLength(1);
        expect(filter.$or).toEqual([
          { [field]: { $exists: false } },
          { $expr: { $in: [`$${field}`, [null, '', []]] } },
        ]);
        expect(options).toEqual({ upsert: false });
      }
      expect(results.every((row) => row.updated === 0)).toBe(true);
    } finally {
      table.mockRestore();
    }
  });
});
