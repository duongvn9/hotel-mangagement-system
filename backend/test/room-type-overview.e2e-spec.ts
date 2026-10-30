import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Amenity } from '../src/modules/amenities/schemas/amenity.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';

describe('Public room type overview (e2e)', () => {
  let app: INestApplication;
  let types: Model<RoomType>;
  let amenities: Model<Amenity>;
  const prefix = 'OVERVIEW-E2E-';
  const activeId = new Types.ObjectId();
  const inactiveTypeId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    types = app.get(getModelToken(RoomType.name));
    amenities = app.get(getModelToken(Amenity.name));
    await types.init();
    await amenities.init();

    const wifi = await amenities.create({ name: prefix + 'Wi-Fi' });
    const closed = await amenities.create({
      name: prefix + 'Closed',
      isActive: false,
    });
    await types.create([
      {
        _id: activeId,
        name: prefix + 'Deluxe',
        description: 'Spacious room with garden view',
        adultCapacity: 2,
        childCapacity: 1,
        basePrice: 1500000,
        // một ref hợp lệ còn hiệu lực, một ref đã ngừng, một ref hỏng (đã xoá).
        amenities: [wifi._id, closed._id, new Types.ObjectId()],
      },
      {
        _id: inactiveTypeId,
        name: prefix + 'Retired',
        adultCapacity: 2,
        childCapacity: 0,
        basePrice: 900000,
        isActive: false,
      },
    ]);
  }, 30000);

  afterAll(async () => {
    if (types) await types.deleteMany({ name: { $regex: '^' + prefix } });
    if (amenities)
      await amenities.deleteMany({ name: { $regex: '^' + prefix } });
    await app?.close();
  });

  it('returns public room type details without authentication', async () => {
    const response = await http()
      .get(`/api/v1/room-types/${activeId}/overview`)
      .expect(200);
    expect(response.body).toMatchObject({
      id: String(activeId),
      name: prefix + 'Deluxe',
      description: 'Spacious room with garden view',
      adultCapacity: 2,
      childCapacity: 1,
      capacity: 3,
      pricePerNight: 1500000,
      amenities: [{ name: prefix + 'Wi-Fi' }],
    });
  });

  it('exposes only active amenities and drops broken references', async () => {
    const response = await http()
      .get(`/api/v1/room-types/${activeId}/overview`)
      .expect(200);
    expect(response.body.amenities).toHaveLength(1);
    expect(response.body.amenities[0]).toMatchObject({ name: prefix + 'Wi-Fi' });
    expect(response.body.amenities[0]).toHaveProperty('id');
  });

  it('never leaks internal or admin-only fields', async () => {
    const response = await http()
      .get(`/api/v1/room-types/${activeId}/overview`)
      .expect(200);
    expect(response.body).not.toHaveProperty('_id');
    expect(response.body).not.toHaveProperty('isActive');
    expect(response.body).not.toHaveProperty('basePrice');
  });

  it('hides room types that are no longer for sale', async () => {
    await http()
      .get(`/api/v1/room-types/${inactiveTypeId}/overview`)
      .expect(404);
  });

  it('returns 404 for an unknown or malformed id', async () => {
    await http()
      .get(`/api/v1/room-types/${new Types.ObjectId()}/overview`)
      .expect(404);
    await http().get('/api/v1/room-types/not-an-id/overview').expect(404);
  });
});
