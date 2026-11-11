import { Model, Types } from 'mongoose';
import { MongoAvailabilityRoomSource } from './mongo-availability-room-source.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';

function roomChain(rows: unknown[]) {
  const query = {
    select: vi.fn(),
    populate: vi.fn(),
    lean: vi.fn(),
    exec: vi.fn().mockResolvedValue(rows),
  };
  for (const key of ['select', 'populate', 'lean'] as const)
    query[key].mockReturnValue(query);
  return query;
}

function typeChain(rows: unknown[]) {
  const query = {
    select: vi.fn(),
    lean: vi.fn(),
    exec: vi.fn().mockResolvedValue(rows),
  };
  for (const key of ['select', 'lean'] as const)
    query[key].mockReturnValue(query);
  return query;
}

const stay = {
  checkIn: new Date('2026-10-23T00:00:00+07:00'),
  checkOut: new Date('2026-10-25T00:00:00+07:00'),
};

const roomRow = (typeId: Types.ObjectId) => ({
  _id: new Types.ObjectId(),
  status: RoomStatus.Available,
  isActive: true,
  roomType: {
    _id: typeId,
    name: 'Deluxe',
    images: [],
    basePrice: 100,
    adultCapacity: 2,
    childCapacity: 0,
    isActive: true,
  },
});

function build(rooms: unknown, roomTypes: unknown) {
  return new MongoAvailabilityRoomSource(
    rooms as Model<Room>,
    roomTypes as Model<RoomType>,
  );
}

describe('MongoAvailabilityRoomSource filters', () => {
  it('skips the room-type query when no room-type filter is present', async () => {
    const rooms = { find: vi.fn().mockReturnValue(roomChain([])) };
    const roomTypes = { find: vi.fn() };
    await build(rooms, roomTypes).findCandidates({ ...stay, guests: 1 });
    expect(roomTypes.find).not.toHaveBeenCalled();
    expect(rooms.find).toHaveBeenCalledWith({ isActive: true });
  });

  it('narrows rooms to matching room types for a bed filter (superset)', async () => {
    const typeId = new Types.ObjectId();
    const roomTypes = {
      find: vi.fn().mockReturnValue(typeChain([{ _id: typeId }])),
    };
    const rooms = {
      find: vi.fn().mockReturnValue(roomChain([roomRow(typeId)])),
    };
    const bedId = String(new Types.ObjectId());
    const result = await build(rooms, roomTypes).findCandidates({
      ...stay,
      guests: 2,
      bedTypeIds: [bedId],
    });
    const typeFilter = roomTypes.find.mock.calls[0][0] as {
      isActive: boolean;
      'beds.bedType': { $all: Types.ObjectId[] };
    };
    expect(typeFilter.isActive).toBe(true);
    expect(typeFilter['beds.bedType'].$all.map(String)).toEqual([bedId]);
    expect(rooms.find.mock.calls[0][0]).toMatchObject({
      isActive: true,
      roomType: { $in: [typeId] },
    });
    expect(result).toHaveLength(1);
  });

  it('returns no candidates when no room type matches the filter', async () => {
    const roomTypes = { find: vi.fn().mockReturnValue(typeChain([])) };
    const rooms = { find: vi.fn() };
    const result = await build(rooms, roomTypes).findCandidates({
      ...stay,
      guests: 1,
      amenityIds: [String(new Types.ObjectId())],
    });
    expect(result).toEqual([]);
    expect(rooms.find).not.toHaveBeenCalled();
  });
});
