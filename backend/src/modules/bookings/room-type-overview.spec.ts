import { Model, Types } from 'mongoose';
import { RoomTypeOverviewService } from './room-type-overview.service.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import type { BedTypesService } from '../bed-types/bed-types.service.js';
import type { AmenitiesService } from '../amenities/amenities.service.js';

const stubbed = (model: unknown) =>
  new RoomTypeOverviewService(
    model as Model<RoomType>,
    {} as BedTypesService,
    {} as AmenitiesService,
  );

function chain(value: unknown) {
  const query = {
    populate: vi.fn(),
    sort: vi.fn(),
    select: vi.fn(),
    lean: vi.fn(),
    exec: vi.fn().mockResolvedValue(value),
  };
  for (const key of ['populate', 'sort', 'select', 'lean'] as const)
    query[key].mockReturnValue(query);
  return query;
}

const activeBed = (name: string, quantity: number) => ({
  bedType: { _id: new Types.ObjectId(), name, isActive: true },
  quantity,
});

describe('RoomTypeOverviewService bed configuration', () => {
  const base = {
    name: 'Deluxe',
    description: '',
    images: [],
    adultCapacity: 2,
    childCapacity: 0,
    basePrice: 1500000,
    isActive: true,
    amenities: [],
  };

  it('returns active beds and drops inactive or broken references in detail', async () => {
    const id = new Types.ObjectId();
    const double = activeBed('Giường đôi', 2);
    const row = {
      ...base,
      _id: id,
      beds: [
        double,
        {
          bedType: {
            _id: new Types.ObjectId(),
            name: 'Ngừng',
            isActive: false,
          },
          quantity: 1,
        },
        { bedType: null, quantity: 1 },
      ],
    };
    const model = { findOne: vi.fn().mockReturnValue(chain(row)) };
    const service = stubbed(model);
    const result = await service.findPublicById(String(id));
    expect(result.beds).toEqual([
      {
        bedTypeId: String(double.bedType._id),
        bedTypeName: 'Giường đôi',
        quantity: 2,
      },
    ]);
  });

  it('includes beds for each room type in the public list', async () => {
    const id = new Types.ObjectId();
    const single = activeBed('Giường đơn', 2);
    const row = { ...base, _id: id, beds: [single] };
    const model = { find: vi.fn().mockReturnValue(chain([row])) };
    const service = stubbed(model);
    const result = await service.listPublic();
    expect(result[0].beds).toEqual([
      {
        bedTypeId: String(single.bedType._id),
        bedTypeName: 'Giường đơn',
        quantity: 2,
      },
    ]);
  });
});

describe('RoomTypeOverviewService search filters', () => {
  it('applies the room-type filter to the public list', async () => {
    const model = { find: vi.fn().mockReturnValue(chain([])) };
    const bedId = String(new Types.ObjectId());
    await stubbed(model).listPublic({ bedTypeIds: [bedId], priceMax: 1000000 });
    const filter = model.find.mock.calls[0][0] as {
      isActive: boolean;
      'beds.bedType': { $all: Types.ObjectId[] };
      basePrice: unknown;
    };
    expect(filter.isActive).toBe(true);
    expect(filter['beds.bedType'].$all.map(String)).toEqual([bedId]);
    expect(filter.basePrice).toEqual({ $lte: 1000000 });
  });

  it('returns active options and price bounds for the filter UI', async () => {
    const model = {
      findOne: vi
        .fn()
        .mockReturnValueOnce(chain({ basePrice: 500000 }))
        .mockReturnValueOnce(chain({ basePrice: 3000000 })),
    };
    const bedTypes = {
      options: vi.fn().mockResolvedValue([{ id: 'b', name: 'Giường đôi' }]),
    };
    const amenities = {
      options: vi.fn().mockResolvedValue([{ id: 'a', name: 'Wi-Fi' }]),
    };
    const service = new RoomTypeOverviewService(
      model as unknown as Model<RoomType>,
      bedTypes as unknown as BedTypesService,
      amenities as unknown as AmenitiesService,
    );
    expect(await service.searchFilters()).toEqual({
      bedTypes: [{ id: 'b', name: 'Giường đôi' }],
      amenities: [{ id: 'a', name: 'Wi-Fi' }],
      priceRange: { min: 500000, max: 3000000 },
    });
  });
});
