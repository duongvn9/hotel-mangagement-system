import { Types } from 'mongoose';
import { hasRoomTypeFilter, roomTypeFilter } from './room-type-filter.js';

const a = String(new Types.ObjectId());
const b = String(new Types.ObjectId());

describe('roomTypeFilter', () => {
  it('is empty and inactive with no params', () => {
    expect(hasRoomTypeFilter({})).toBe(false);
    expect(roomTypeFilter({})).toEqual({});
    expect(hasRoomTypeFilter({ bedTypeIds: [] })).toBe(false);
  });

  it('requires every bed type and amenity (AND / superset)', () => {
    const filter = roomTypeFilter({ bedTypeIds: [a, b], amenityIds: [a] });
    expect(
      (filter['beds.bedType'] as { $all: Types.ObjectId[] }).$all.map(String),
    ).toEqual([a, b]);
    expect(
      (filter.amenities as { $all: Types.ObjectId[] }).$all.map(String),
    ).toEqual([a]);
    expect(hasRoomTypeFilter({ amenityIds: [a] })).toBe(true);
  });

  it('builds price range and occupancy gates', () => {
    expect(roomTypeFilter({ priceMin: 100, priceMax: 500 }).basePrice).toEqual({
      $gte: 100,
      $lte: 500,
    });
    expect(roomTypeFilter({ priceMin: 100 }).basePrice).toEqual({ $gte: 100 });
    expect(roomTypeFilter({ priceMax: 500 }).basePrice).toEqual({ $lte: 500 });
    expect(roomTypeFilter({ adults: 2, children: 1 })).toMatchObject({
      adultCapacity: { $gte: 2 },
      childCapacity: { $gte: 1 },
    });
  });
});
