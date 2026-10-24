import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { RoomStatus } from '../src/common/constants/room-status.enum.js';
import { seedRooms } from '../src/modules/rooms/seed.js';
import { seedRoomTypes } from '../src/modules/room-types/seed.js';
import { seedAmenities } from '../src/modules/amenities/seed.js';

describe('UC47 rooms read API', () => {
  let app: INestApplication;
  let rooms: Model<Room>;
  let types: Model<RoomType>;
  let activeType: Types.ObjectId;
  const prefix = 'UC47-E2E-';
  const manager = { 'x-dev-role': 'MANAGER' };
  const http = () => request(app.getHttpServer());
  const get = () => http().get('/api/v1/rooms').set(manager);
  beforeAll(async () => {
    if (!/test/.test(process.env.MONGODB_URI ?? ''))
      throw new Error('Dedicated test DB required');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    rooms = app.get(getModelToken(Room.name));
    types = app.get(getModelToken(RoomType.name));
    await Promise.all([rooms.init(), types.init()]);
    activeType = (
      await types.create({
        name: prefix + 'Standard',
        adultCapacity: 2,
        childCapacity: 0,
        basePrice: 1,
      })
    )._id;
    const inactiveType = (
      await types.create({
        name: prefix + 'Suite',
        adultCapacity: 4,
        childCapacity: 2,
        basePrice: 1,
        isActive: false,
      })
    )._id;
    await rooms.create([
      {
        roomNumber: prefix + '20',
        floor: 0,
        roomType: activeType,
        status: RoomStatus.Occupied,
        notes: 'Ghi chú phòng',
      },
      {
        roomNumber: prefix + '101',
        floor: 1,
        roomType: inactiveType,
        status: RoomStatus.Cleaning,
        isActive: false,
      },
      {
        roomNumber: prefix + '1010',
        floor: 2,
        roomType: activeType,
        status: RoomStatus.Maintenance,
      },
      {
        roomNumber: prefix + 'A.*[x]',
        floor: -1,
        roomType: new Types.ObjectId(),
      },
    ]);
  }, 60000);
  afterAll(async () => {
    if (rooms) await rooms.deleteMany({ roomNumber: { $regex: '^' + prefix } });
    if (types) await types.deleteMany({ name: { $regex: '^' + prefix } });
    await app?.close();
  });
  it('requires authentication and blocks the four other system roles', async () => {
    await http().get('/api/v1/rooms').expect(401);
    for (const role of [
      'CUSTOMER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ])
      await http().get('/api/v1/rooms').set({ 'x-dev-role': role }).expect(403);
  });
  it('lists inactive rooms/types too and tolerates a missing type', async () => {
    const result = await get().query({ search: prefix }).expect(200);
    expect(result.body.total).toBe(4);
    expect(
      result.body.items.find((row: Room) => row.roomNumber === prefix + '101'),
    ).toMatchObject({
      isActive: false,
      roomType: { isActive: false, name: prefix + 'Suite' },
    });
    expect(
      result.body.items.find(
        (row: Room) => row.roomNumber === prefix + 'A.*[x]',
      ),
    ).toMatchObject({ roomType: null, status: 'AVAILABLE', notes: '' });
    expect(result.body.items[0]).not.toHaveProperty('_id');
    expect(result.body.items[0]).not.toHaveProperty('capacity');
  });
  it('uses numeric room-number ordering and keeps total while paginating', async () => {
    const first = await get().query({ search: prefix, limit: 2 }).expect(200);
    expect(first.body.items.map((row: Room) => row.roomNumber)).toEqual([
      prefix + '20',
      prefix + '101',
    ]);
    expect(first.body).toMatchObject({ total: 4, page: 1, limit: 2 });
    const second = await get()
      .query({ search: prefix, page: 2, limit: 2 })
      .expect(200);
    expect(second.body.items[0].roomNumber).toBe(prefix + '1010');
    const floor = await get()
      .query({ search: prefix, sortBy: 'floor', sortOrder: 'desc' })
      .expect(200);
    expect(floor.body.items[0].floor).toBe(2);
    const status = await get()
      .query({ search: prefix, sortBy: 'status' })
      .expect(200);
    expect(status.body.items[0].status).toBe('AVAILABLE');
  });
  it('filters escaped literal search, type, status, active and floor zero', async () => {
    expect(
      (await get().query({ search: 'a.*[X]' }).expect(200)).body.total,
    ).toBe(1);
    expect(
      (
        await get()
          .query({ search: prefix, roomTypeId: String(activeType) })
          .expect(200)
      ).body.total,
    ).toBe(2);
    expect(
      (
        await get()
          .query({
            search: prefix,
            status: 'CLEANING',
            isActive: false,
            floor: 1,
          })
          .expect(200)
      ).body.items[0].roomNumber,
    ).toBe(prefix + '101');
    expect(
      (await get().query({ search: prefix, floor: 0 }).expect(200)).body
        .items[0].roomNumber,
    ).toBe(prefix + '20');
  });
  it.each([
    { page: 0 },
    { limit: 1000 },
    { status: 'RESERVED' },
    { roomTypeId: 'bad' },
    { unexpected: 'x' },
    { floor: 1.5 },
    { isActive: 'yes' },
    { sortBy: 'notes' },
    { sortOrder: 'wrong' },
  ])('rejects invalid query %j with standard errors', async (query) => {
    expect((await get().query(query).expect(400)).body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: expect.stringContaining('/api/v1/rooms'),
    });
  });
  it('returns empty results and never mutates room or type data on reads', async () => {
    const before = await rooms
      .find({ roomNumber: { $regex: '^' + prefix } })
      .sort({ _id: 1 })
      .lean();
    const typeBefore = await types.findById(activeType).lean();
    await get().query({ search: prefix }).expect(200);
    await get().query({ search: prefix }).expect(200);
    expect(
      (
        await get()
          .query({ search: prefix + 'absent' })
          .expect(200)
      ).body,
    ).toEqual({ items: [], total: 0, page: 1, limit: 10 });
    expect(
      await rooms
        .find({ roomNumber: { $regex: '^' + prefix } })
        .sort({ _id: 1 })
        .lean(),
    ).toEqual(before);
    expect(await types.findById(activeType).lean()).toEqual(typeBefore);
  });
  it('enforces the unique room number index and has no DELETE endpoint', async () => {
    await expect(
      rooms.create({
        roomNumber: prefix + '20',
        floor: 1,
        roomType: activeType,
      }),
    ).rejects.toMatchObject({ code: 11000 });
    await http().post('/api/v1/rooms').set(manager).send({}).expect(400);
    await http()
      .patch('/api/v1/rooms/' + new Types.ObjectId())
      .set(manager)
      .send({})
      .expect(400);
    await http()
      .delete('/api/v1/rooms/' + new Types.ObjectId())
      .set(manager)
      .expect(404);
  });
  it('seeds rooms twice without duplicates or overwriting Manager edits', async () => {
    const existing = new Set(
      (await rooms.find().select('_id').lean()).map((row) => String(row._id)),
    );
    await seedAmenities(app);
    await seedRoomTypes(app);
    await seedRooms(app);
    const inserted = (
      await rooms
        .find({
          roomNumber: { $in: ['101', '102', '201', '202', '301', '302'] },
        })
        .select('_id')
        .lean()
    )
      .filter((row) => !existing.has(String(row._id)))
      .map((row) => row._id);
    try {
      const sample = await rooms.findOne({ roomNumber: '101' }).orFail();
      const original = sample.toObject();
      await rooms.updateOne(
        { _id: sample._id },
        { $set: { notes: 'UC47 Manager edited', floor: 8 } },
      );
      const before = await rooms.findById(sample._id).lean();
      const count = await rooms.countDocuments();
      await seedRooms(app);
      await seedRooms(app);
      expect(await rooms.countDocuments()).toBe(count);
      expect(await rooms.findById(sample._id).lean()).toEqual(before);
      await rooms.updateOne(
        { _id: sample._id },
        { $set: { notes: original.notes, floor: original.floor } },
      );
    } finally {
      await rooms.deleteMany({ _id: { $in: inserted } });
    }
  });
  it('documents GET /rooms, filters, four statuses and the nullable room type', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('UC47').build(),
    );
    const operation = document.paths['/api/v1/rooms'].get!;
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'roomTypeId' }),
        expect.objectContaining({ name: 'floor' }),
        expect.objectContaining({ name: 'status' }),
      ]),
    );
    expect(document.components?.schemas?.RoomResponse).toHaveProperty(
      'properties.roomType.nullable',
      true,
    );
    expect(document.components?.schemas?.RoomResponse).toHaveProperty(
      'properties.status.enum',
      Object.values(RoomStatus),
    );
  });
});
