import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Model } from 'mongoose';
import { AppModule } from '../src/app.module.js';
import { runSeeds } from '../src/database/seed.js';
import { Permission } from '../src/modules/roles/schemas/permission.schema.js';
import { Role } from '../src/modules/roles/schemas/role.schema.js';
import { PERMISSIONS, SYSTEM_ROLES } from '../src/modules/roles/seed.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { SAMPLE_USERS } from '../src/modules/users/seed.js';
import {
  Booking,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';
import { Feedback } from '../src/modules/feedback/schemas/feedback.schema.js';
import { SAMPLE_FEEDBACK, seedFeedback } from '../src/modules/feedback/seed.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { Types } from 'mongoose';

// Cần MongoDB đang chạy (xem health.e2e-spec.ts).
describe('Seed (e2e)', () => {
  let app: INestApplication;
  let roles: Model<Role>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    roles = app.get(getModelToken(Role.name));
    // Dữ liệu mẫu do e2e khác để lại (ví dụ phòng 101 bị khoá ở rooms-write) làm seed bỏ qua booking.
    const customer = await app
      .get<Model<User>>(getModelToken(User.name))
      .findOne({ email: 'customer@hms.local' });
    if (customer)
      await app
        .get<Model<Feedback>>(getModelToken(Feedback.name))
        .deleteMany({ customer: customer._id });
    await app
      .get<Model<Booking>>(getModelToken(Booking.name))
      .deleteMany({ code: /^SEED-/ });
    await app.get<Model<Room>>(getModelToken(Room.name)).deleteMany({
      roomNumber: { $in: ['101', '102', '201', '202', '301', '302'] },
    });
    await Promise.all(
      [Role.name, Permission.name, User.name].map((name) =>
        app.get<Model<unknown>>(getModelToken(name)).deleteMany({}),
      ),
    );
  });

  afterAll(async () => {
    await app
      .get<Model<Booking>>(getModelToken(Booking.name))
      .deleteMany({ code: /^SEED-/ });
    await app.close();
  });

  it('chạy 2 lần không tạo trùng và không ghi đè dữ liệu đã sửa', async () => {
    await runSeeds(app);
    await roles.updateOne(
      { code: 'MANAGER' },
      { permissions: ['report:view'] },
    );
    await runSeeds(app);

    const count = (name: string) =>
      app.get<Model<unknown>>(getModelToken(name)).countDocuments();
    expect(await count(Permission.name)).toBe(Object.keys(PERMISSIONS).length);
    expect(await count(Role.name)).toBe(SYSTEM_ROLES.length);
    expect(await count(User.name)).toBe(SAMPLE_USERS.length);

    const manager = await roles.findOne({ code: 'MANAGER' }).lean();
    expect(manager).toMatchObject({
      isSystem: true,
      permissions: ['report:view'],
    });
  });

  it('tạo booking CHECKED_IN mẫu và gắn phản hồi mẫu vào booking đã trả phòng', async () => {
    await runSeeds(app);
    const bookings = app.get<Model<Booking>>(getModelToken(Booking.name));
    const feedback = app.get<Model<Feedback>>(getModelToken(Feedback.name));
    const customer = await app
      .get<Model<User>>(getModelToken(User.name))
      .findOne({ email: 'customer@hms.local' })
      .orFail();

    const checkedIn = await bookings
      .findOne({ code: 'SEED-CHECKED-IN-001' })
      .populate<{
        rooms: (Room & { _id: Types.ObjectId; roomType: RoomType })[];
      }>({
        path: 'rooms',
        populate: { path: 'roomType' },
      })
      .orFail();
    const rate = checkedIn.rooms[0].roomType.basePrice;
    expect(checkedIn.status).toBe('CHECKED_IN');
    expect(String(checkedIn.customer)).toBe(String(customer._id));
    expect(checkedIn.rooms.map((room) => room.roomNumber)).toEqual(['101']);
    expect(checkedIn.rooms[0].status).toBe('OCCUPIED');
    // Giá lấy theo RoomType hiện tại (e2e khác có thể đã sửa giá Standard).
    expect(checkedIn.roomTotal).toBe(rate * 2);
    expect(checkedIn.depositAmount).toBe(Math.round(rate * 2 * 0.3));
    expect(
      checkedIn.rateSnapshot.map(({ room, ratePerNight }) => ({
        room: String(room),
        ratePerNight,
      })),
    ).toEqual([{ room: String(checkedIn.rooms[0]._id), ratePerNight: rate }]);
    expect(
      await bookings.countDocuments({
        code: /^SEED-CHECKED-OUT-/,
        customer: customer._id,
        status: BookingStatus.CheckedOut,
        checkedOutAt: { $exists: true },
      }),
    ).toBe(3);

    const rows = await feedback
      .find({ customer: customer._id })
      .populate<{ booking: Booking }>('booking')
      .lean();
    expect(rows).toHaveLength(SAMPLE_FEEDBACK.length);
    expect(rows.map((row) => row.booking.code).sort()).toEqual(
      SAMPLE_FEEDBACK.map((sample) => sample.bookingCode).sort(),
    );
    expect(rows.every((row) => row.booking.status === 'CHECKED_OUT')).toBe(
      true,
    );
  });

  it('chuyển phản hồi mẫu cũ (booking giả) sang booking thật, giữ câu trả lời', async () => {
    const feedback = app.get<Model<Feedback>>(getModelToken(Feedback.name));
    const customer = await app
      .get<Model<User>>(getModelToken(User.name))
      .findOne({ email: 'customer@hms.local' })
      .orFail();
    const [first] = SAMPLE_FEEDBACK;
    await feedback.deleteMany({ customer: customer._id });
    await feedback.create({
      customer: customer._id,
      booking: new Types.ObjectId(first.legacyBooking),
      content: first.content,
      reply: {
        content: 'Cảm ơn bạn',
        repliedBy: customer._id,
        repliedAt: new Date(),
      },
    });

    await seedFeedback(app);
    await seedFeedback(app);

    expect(await feedback.countDocuments({ customer: customer._id })).toBe(
      SAMPLE_FEEDBACK.length,
    );
    const migrated = await feedback
      .findOne({ customer: customer._id, content: first.content })
      .populate<{ booking: Booking }>('booking')
      .orFail();
    expect(migrated.booking.code).toBe(first.bookingCode);
    expect(migrated.reply?.content).toBe('Cảm ơn bạn');
  });
});
