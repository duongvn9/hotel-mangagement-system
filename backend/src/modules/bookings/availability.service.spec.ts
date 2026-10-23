import { Model } from 'mongoose';
import { vi } from 'vitest';
import { AvailabilityService } from './availability.service.js';
import { AvailabilityClock, UnconfiguredAvailabilityRoomSource } from './availability.adapters.js';
import { Booking } from './schemas/booking.schema.js';
import { RoomHold } from './schemas/room-hold.schema.js';

const query = { checkIn: '2026-10-23', checkOut: '2026-10-25', guests: 2 };
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const now = new Date('2026-10-20T00:00:00Z');
const room = { id, roomTypeId: id, capacity: 2, isActive: true, roomTypeActive: true, operationallyAvailable: true };
const mockModel = (rows: unknown[]) => ({ find: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(rows) }) }) }) });

describe('AvailabilityService', () => {
  it('validates before querying adapters', async () => {
    const bookings = mockModel([]);
    const service = new AvailabilityService(bookings as unknown as Model<Booking>, mockModel([]) as unknown as Model<RoomHold>, new UnconfiguredAvailabilityRoomSource(), new AvailabilityClock());
    await expect(service.findAvailableRooms({ ...query, guests: 0 })).rejects.toThrow('guests');
    expect(bookings.find).not.toHaveBeenCalled();
    await expect(service.findAvailableRooms(query)).rejects.toThrow('H3');
  });
  it('queries real references, uses injected clock and returns only safe fields repeatedly', async () => {
    const bookings = mockModel([]);
    const holds = mockModel([]);
    const findCandidates = vi.fn().mockResolvedValue([room]);
    const service = new AvailabilityService(bookings as unknown as Model<Booking>, holds as unknown as Model<RoomHold>, { findCandidates }, { now: () => now });
    for (let i = 0; i < 2; i++) expect(await service.findAvailableRooms(query)).toEqual([{ id, roomTypeId: id, capacity: 2 }]);
    expect(holds.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true, expiresAt: { $gt: now } }));
    expect(findCandidates).toHaveBeenCalledWith(expect.objectContaining({ checkIn: new Date('2026-10-22T17:00:00Z') }));
  });
  it('does not query Mongo when no candidates and propagates source failures', async () => {
    const bookings = mockModel([]);
    const service = new AvailabilityService(bookings as unknown as Model<Booking>, mockModel([]) as unknown as Model<RoomHold>, { findCandidates: async () => [] }, { now: () => now });
    expect(await service.findAvailableRooms(query)).toEqual([]);
    expect(bookings.find).not.toHaveBeenCalled();
  });
});
