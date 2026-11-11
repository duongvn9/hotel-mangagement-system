import { Model, Types } from 'mongoose';
import { RoomTypeOverviewService } from './room-type-overview.service.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';

function chain(value: unknown) {
  const query = {
    populate: vi.fn(),
    sort: vi.fn(),
    lean: vi.fn(),
    exec: vi.fn().mockResolvedValue(value),
  };
  for (const key of ['populate', 'sort', 'lean'] as const)
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
    const service = new RoomTypeOverviewService(
      model as unknown as Model<RoomType>,
    );
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
    const service = new RoomTypeOverviewService(
      model as unknown as Model<RoomType>,
    );
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
