import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { businessBoundary, calculateAvailability, normalizeStay, overlaps, type AvailabilityBooking, type AvailabilityHold, type AvailabilityRoom } from './availability.core.js';

const query = { checkIn: '2026-10-23', checkOut: '2026-10-25', guests: 2 };
const now = new Date('2026-10-20T00:00:00Z');
const room: AvailabilityRoom = { id: 'a', roomTypeId: 'aaaaaaaaaaaaaaaaaaaaaaaa', capacity: 2, isActive: true, roomTypeActive: true, operationallyAvailable: true };
const booking: AvailabilityBooking = { id: 'b', rooms: ['a', 'c'], ...normalizeStay(query), status: BookingStatus.Confirmed, isActive: true };
const hold: AvailabilityHold = { bookingId: 'b', rooms: ['a'], ...normalizeStay(query), expiresAt: new Date('2026-10-21T00:00:00Z'), isActive: true };
const run = (bookings: AvailabilityBooking[] = [], holds: AvailabilityHold[] = [], rooms = [room]) => calculateAvailability(query, rooms, bookings, holds, now);

describe('availability core', () => {
  it('returns safe fresh results with no reservations', () => {
    expect(run()).toEqual([{ id: room.id, roomTypeId: room.roomTypeId, capacity: 2 }]);
    expect(run()).not.toBe(run());
    expect(run()).toEqual(run());
  });
  it.each([['2026-10-23', '2026-10-25'], ['2026-10-22', '2026-10-24'], ['2026-10-24', '2026-10-26'], ['2026-10-22', '2026-10-26'], ['2026-10-23', '2026-10-24']])('blocks overlap %s %s both ways', (checkIn, checkOut) => {
    const interval = normalizeStay({ checkIn, checkOut });
    expect(overlaps(interval, booking)).toBe(true);
    expect(overlaps(booking, interval)).toBe(true);
    expect(run([{ ...booking, ...interval }])).toEqual([]);
  });
  it.each([['2026-10-21', '2026-10-23'], ['2026-10-25', '2026-10-27']])('allows adjacency %s', (checkIn, checkOut) => {
    expect(run([{ ...booking, ...normalizeStay({ checkIn, checkOut }) }])).toHaveLength(1);
  });
  it.each([BookingStatus.Confirmed, BookingStatus.CheckedIn])('blocks multiroom %s', (status) => {
    expect(run([{ ...booking, status }], [], [room, { ...room, id: 'c' }])).toEqual([]);
  });
  it.each([BookingStatus.Cancelled, BookingStatus.CheckedOut, BookingStatus.PendingDeposit])('does not block alone %s', (status) => {
    expect(run([{ ...booking, status }])).toHaveLength(1);
  });
  it('requires an active unexpired hold for pending and ignores TTL persistence', () => {
    const pending = { ...booking, status: BookingStatus.PendingDeposit };
    expect(run([pending], [hold])).toEqual([]);
    for (const expired of [now, new Date(now.getTime() - 1)]) expect(run([pending], [{ ...hold, expiresAt: expired }])).toHaveLength(1);
    expect(run([pending], [{ ...hold, isActive: false }])).toHaveLength(1);
    expect(run([pending], [{ ...hold, rooms: ['other'] }])).toHaveLength(1);
  });
  it.each([BookingStatus.Cancelled, BookingStatus.CheckedOut])('ignores stale holds for %s', (status) => {
    expect(run([{ ...booking, status }], [hold])).toHaveLength(1);
  });
  it('ignores inactive parent and booking', () => expect(run([{ ...booking, isActive: false }], [hold])).toHaveLength(1));
  it('conservatively blocks orphan and inconsistent holds until expiry', () => {
    expect(run([], [hold])).toEqual([]);
    expect(run([{ ...booking, rooms: ['other'], status: BookingStatus.PendingDeposit }], [hold])).toEqual([]);
  });
  it('deduplicates multiple conflicts without changing inputs', () => {
    expect(run([booking, { ...booking, id: 'second' }], [hold, hold])).toEqual([]);
    expect(booking.rooms).toEqual(['a', 'c']);
    expect(run([], [], [room, room])).toHaveLength(1);
  });
  it('filters capacity, room type and operational restrictions', () => {
    for (const change of [{ capacity: 1 }, { capacity: NaN }, { isActive: false }, { roomTypeActive: false }, { operationallyAvailable: false }]) expect(run([], [], [{ ...room, ...change }])).toEqual([]);
    expect(calculateAvailability({ ...query, roomTypeId: room.roomTypeId }, [room], [], [], now)).toHaveLength(1);
    expect(calculateAvailability({ ...query, roomTypeId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, [room], [], [], now)).toEqual([]);
  });
  it.each(['invalid', '2026-02-30', '2026-13-01', '2026-10-23T00:00:00', new Date(NaN)])('rejects invalid dates %s in either boundary', (value) => {
    expect(() => normalizeStay({ ...query, checkIn: value })).toThrow();
    expect(() => normalizeStay({ ...query, checkOut: value })).toThrow();
  });
  it('rejects same/reversed dates and invalid guests/type', () => {
    for (const checkOut of ['2026-10-23', '2026-10-22']) expect(() => normalizeStay({ ...query, checkOut })).toThrow();
    for (const guests of [0, -1, 1.5, NaN]) expect(() => calculateAvailability({ ...query, guests }, [], [], [], now)).toThrow();
    expect(() => calculateAvailability({ ...query, roomTypeId: '' }, [], [], [], now)).toThrow();
  });
  it('uses explicit Vietnam midnight independent of host timezone', () => {
    expect(businessBoundary('2026-10-23').toISOString()).toBe('2026-10-22T17:00:00.000Z');
    expect(businessBoundary(new Date('2026-10-22T17:00:00Z'))).toEqual(businessBoundary('2026-10-23'));
    expect(businessBoundary(new Date('2026-10-22T16:59:59Z'))).toEqual(businessBoundary('2026-10-22'));
  });
  it('fails closed for malformed active intervals', () => expect(run([{ ...booking, checkOut: new Date(NaN) }])).toEqual([]));
});
