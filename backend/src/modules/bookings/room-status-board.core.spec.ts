import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import {
  buildRoomStatusBoard,
  businessDay,
  type BoardBooking,
  type BoardRoom,
} from './room-status-board.core.js';

const vn = (day: string) => new Date(`${day}T00:00:00.000+07:00`);

const room = (id: string, overrides: Partial<BoardRoom> = {}): BoardRoom => ({
  id,
  roomNumber: id.toUpperCase(),
  floor: 1,
  roomTypeId: 't1',
  roomTypeName: 'Deluxe',
  capacity: 3,
  status: RoomStatus.Available,
  ...overrides,
});

const booking = (
  code: string,
  status: BookingStatus,
  checkIn: string,
  checkOut: string,
  rooms: string[] = ['r1'],
): BoardBooking => ({
  code,
  status,
  guestName: `Guest ${code}`,
  rooms,
  checkIn: vn(checkIn),
  checkOut: vn(checkOut),
});

const board = (
  rooms: BoardRoom[],
  bookings: BoardBooking[],
  options: { date?: string; today?: boolean; hold?: string[] } = {},
) =>
  buildRoomStatusBoard({
    date: options.date ?? '2026-10-27',
    isToday: options.today ?? false,
    rooms,
    bookings,
    liveHoldCodes: new Set(options.hold ?? []),
  });

describe('businessDay', () => {
  it('returns the Vietnam business day of an instant', () => {
    expect(businessDay(new Date('2026-10-26T17:00:00.000Z'))).toBe(
      '2026-10-27',
    );
    expect(businessDay(new Date('2026-10-27T16:59:59.000Z'))).toBe(
      '2026-10-27',
    );
  });
});

describe('buildRoomStatusBoard', () => {
  it('marks rooms without a booking as free', () => {
    const result = board([room('r1')], []);
    expect(result.rooms[0]).toMatchObject({
      id: 'r1',
      occupancy: 'FREE',
      booking: null,
      physicalStatus: null,
    });
    expect(result.summary).toMatchObject({ total: 1, free: 1 });
  });

  it('maps booking status to occupancy', () => {
    const result = board(
      [room('r1'), room('r2'), room('r3')],
      [
        booking('IN', BookingStatus.CheckedIn, '2026-10-26', '2026-10-28', [
          'r1',
        ]),
        booking('RS', BookingStatus.Confirmed, '2026-10-27', '2026-10-29', [
          'r2',
        ]),
        booking(
          'HD',
          BookingStatus.PendingDeposit,
          '2026-10-27',
          '2026-10-28',
          ['r3'],
        ),
      ],
      { hold: ['HD'] },
    );
    expect(result.rooms.map((entry) => entry.occupancy)).toEqual([
      'IN_HOUSE',
      'RESERVED',
      'HELD',
    ]);
    expect(result.rooms[0]?.booking).toMatchObject({
      code: 'IN',
      guestName: 'Guest IN',
      status: BookingStatus.CheckedIn,
    });
    expect(result.summary).toMatchObject({
      total: 3,
      free: 0,
      held: 1,
      reserved: 1,
      inHouse: 1,
    });
  });

  it('ignores a pending booking whose hold is gone, and finished bookings', () => {
    const result = board(
      [room('r1'), room('r2')],
      [
        booking(
          'HD',
          BookingStatus.PendingDeposit,
          '2026-10-27',
          '2026-10-28',
          ['r1'],
        ),
        booking('OUT', BookingStatus.CheckedOut, '2026-10-27', '2026-10-28', [
          'r2',
        ]),
        booking('CX', BookingStatus.Cancelled, '2026-10-27', '2026-10-28', [
          'r2',
        ]),
      ],
    );
    expect(result.rooms.map((entry) => entry.occupancy)).toEqual([
      'FREE',
      'FREE',
    ]);
  });

  it('covers check-in day but not check-out day', () => {
    const stay = [
      booking('RS', BookingStatus.Confirmed, '2026-10-27', '2026-10-29'),
    ];
    expect(
      board([room('r1')], stay, { date: '2026-10-26' }).rooms[0]?.occupancy,
    ).toBe('FREE');
    expect(
      board([room('r1')], stay, { date: '2026-10-27' }).rooms[0]?.occupancy,
    ).toBe('RESERVED');
    expect(
      board([room('r1')], stay, { date: '2026-10-28' }).rooms[0]?.occupancy,
    ).toBe('RESERVED');
    expect(
      board([room('r1')], stay, { date: '2026-10-29' }).rooms[0]?.occupancy,
    ).toBe('FREE');
  });

  it('prefers in-house over reserved over held when bookings overlap on a day', () => {
    // Khách ở đến sáng 27 và khách mới nhận chiều 27: cả hai chạm ngày 27.
    const result = board(
      [room('r1')],
      [
        booking('RS', BookingStatus.Confirmed, '2026-10-27', '2026-10-28'),
        booking('IN', BookingStatus.CheckedIn, '2026-10-25', '2026-10-28'),
      ],
    );
    expect(result.rooms[0]?.occupancy).toBe('IN_HOUSE');
    expect(result.rooms[0]?.booking?.code).toBe('IN');
  });

  it('shows maintenance on any date but occupied/cleaning only today', () => {
    const rooms = [
      room('m', { status: RoomStatus.Maintenance }),
      room('o', { status: RoomStatus.Occupied }),
      room('c', { status: RoomStatus.Cleaning }),
      room('a', { status: RoomStatus.Available }),
    ];
    const byId = (result: ReturnType<typeof board>) =>
      Object.fromEntries(
        result.rooms.map((entry) => [entry.id, entry.physicalStatus]),
      );
    expect(byId(board(rooms, []))).toEqual({
      m: RoomStatus.Maintenance,
      o: null,
      c: null,
      a: null,
    });
    const today = board(rooms, [], { today: true });
    expect(byId(today)).toEqual({
      m: RoomStatus.Maintenance,
      o: RoomStatus.Occupied,
      c: RoomStatus.Cleaning,
      a: null,
    });
    expect(today.summary).toMatchObject({
      total: 4,
      maintenance: 1,
      cleaning: 1,
      // Phòng bảo trì không tính là phòng trống.
      free: 3,
    });
  });

  it('sorts rooms by floor then room number and keeps the date', () => {
    const result = board(
      [
        room('r10', { roomNumber: '210', floor: 2 }),
        room('r2', { roomNumber: '102', floor: 1 }),
        room('r9', { roomNumber: '1010', floor: 1 }),
        room('r1', { roomNumber: '101', floor: 1 }),
      ],
      [],
    );
    expect(result.date).toBe('2026-10-27');
    expect(result.rooms.map((entry) => entry.roomNumber)).toEqual([
      '101',
      '102',
      '1010',
      '210',
    ]);
  });
});
