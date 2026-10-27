import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import {
  applyReplacements,
  checkInStatusError,
  checkInWindowError,
  describeNotReady,
  notReadyRooms,
  replacementShapeError,
} from './check-in.core.js';

const vn = (day: string) => new Date(`${day}T00:00:00.000+07:00`);

describe('checkInStatusError', () => {
  it('only allows confirmed bookings', () => {
    expect(checkInStatusError(BookingStatus.Confirmed)).toBeNull();
  });

  it('explains why other statuses cannot check in', () => {
    expect(checkInStatusError(BookingStatus.PendingDeposit)).toMatch(
      /deposit/i,
    );
    expect(checkInStatusError(BookingStatus.CheckedIn)).toMatch(/already/i);
    expect(checkInStatusError(BookingStatus.CheckedOut)).toMatch(/cannot/i);
    expect(checkInStatusError(BookingStatus.Cancelled)).toMatch(/cannot/i);
  });
});

describe('checkInWindowError', () => {
  const checkIn = vn('2026-10-27');
  const checkOut = vn('2026-10-29');

  it('allows the arrival day and any later day before check-out', () => {
    expect(checkInWindowError('2026-10-27', checkIn, checkOut)).toBeNull();
    expect(checkInWindowError('2026-10-28', checkIn, checkOut)).toBeNull();
  });

  it('rejects arriving before the booked day', () => {
    expect(checkInWindowError('2026-10-26', checkIn, checkOut)).toMatch(
      /2026-10-27/,
    );
  });

  it('rejects arriving on or after the check-out day', () => {
    expect(checkInWindowError('2026-10-29', checkIn, checkOut)).toMatch(
      /ended/i,
    );
    expect(checkInWindowError('2026-11-02', checkIn, checkOut)).toMatch(
      /ended/i,
    );
  });
});

describe('notReadyRooms', () => {
  it('lists rooms that are inactive or not physically available', () => {
    const result = notReadyRooms([
      { roomNumber: '101', isActive: true, status: RoomStatus.Available },
      { roomNumber: '102', isActive: true, status: RoomStatus.Cleaning },
      { roomNumber: '103', isActive: true, status: RoomStatus.Occupied },
      { roomNumber: '104', isActive: true, status: RoomStatus.Maintenance },
      { roomNumber: '105', isActive: false, status: RoomStatus.Available },
    ]);
    expect(result.map((room) => room.roomNumber)).toEqual([
      '102',
      '103',
      '104',
      '105',
    ]);
    expect(describeNotReady(result)).toBe(
      'Rooms not ready: 102 (CLEANING), 103 (OCCUPIED), 104 (MAINTENANCE), 105 (INACTIVE)',
    );
  });

  it('returns nothing when every room is ready', () => {
    expect(
      notReadyRooms([
        { roomNumber: '101', isActive: true, status: RoomStatus.Available },
      ]),
    ).toEqual([]);
  });
});

describe('replacementShapeError', () => {
  const current = ['a', 'b'];

  it('accepts distinct swaps of rooms in the booking for rooms outside it', () => {
    expect(replacementShapeError(current, [{ from: 'a', to: 'c' }])).toBeNull();
    expect(
      replacementShapeError(current, [
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
      ]),
    ).toBeNull();
  });

  it('rejects unknown sources, duplicates and targets already in the booking', () => {
    expect(replacementShapeError(current, [{ from: 'x', to: 'c' }])).toMatch(
      /not part of/i,
    );
    expect(
      replacementShapeError(current, [
        { from: 'a', to: 'c' },
        { from: 'a', to: 'd' },
      ]),
    ).toMatch(/more than once/i);
    expect(
      replacementShapeError(current, [
        { from: 'a', to: 'c' },
        { from: 'b', to: 'c' },
      ]),
    ).toMatch(/more than once/i);
    expect(replacementShapeError(current, [{ from: 'a', to: 'b' }])).toMatch(
      /already/i,
    );
    expect(replacementShapeError(current, [{ from: 'a', to: 'a' }])).toMatch(
      /already/i,
    );
  });
});

describe('applyReplacements', () => {
  it('swaps rooms in place and keeps the order', () => {
    expect(
      applyReplacements(['a', 'b', 'c'], [{ from: 'b', to: 'z' }]),
    ).toEqual(['a', 'z', 'c']);
    expect(applyReplacements(['a', 'b'], [])).toEqual(['a', 'b']);
  });
});
