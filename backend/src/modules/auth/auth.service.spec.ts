import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import type { Role } from '../roles/schemas/role.schema.js';
import type { User } from '../users/schemas/user.schema.js';
import { AuthService } from './auth.service.js';

const USER_ID = '6718a1b2c3d4e5f601234567';
const lean = (value: unknown) => ({ lean: () => Promise.resolve(value) });

function service(env = 'development', user: object | null = null) {
  const users = {
    findById: vi.fn(() => lean(user)),
    exists: vi.fn(() => Promise.resolve(user ? { _id: 'x' } : null)),
    create: vi.fn((doc: object) =>
      Promise.resolve({ _id: USER_ID, emailVerified: false, ...doc }),
    ),
  };
  const roles = {
    findOne: vi.fn(() => lean({ permissions: ['report:view'] })),
  };
  const config = { get: () => env } as unknown as ConfigService<any, true>;
  const verifier = {
    verifyIdToken: (t: string) =>
      t === 'good'
        ? Promise.resolve({ uid: 'uid-1', email: 'New@Mail.vn' } as any)
        : Promise.reject(new Error()),
  };
  const svc = new AuthService(
    users as unknown as Model<User>,
    roles as unknown as Model<Role>,
    config,
    verifier,
  );
  return Object.assign(svc, { users });
}

describe('AuthService', () => {
  it('me(): lấy thông tin User và permission của role', async () => {
    const user = { email: 'manager@hms.local', fullName: 'Quản Lý' };
    await expect(
      service('development', user).me({
        id: USER_ID,
        email: 'x',
        role: 'MANAGER',
      }),
    ).resolves.toEqual({
      id: USER_ID,
      email: 'manager@hms.local',
      fullName: 'Quản Lý',
      phone: undefined,
      role: 'MANAGER',
      permissions: ['report:view'],
    });
  });

  it('me(): user dev chưa có trong DB vẫn trả về được', async () => {
    const me = await service().me({
      id: '000000000000000000000001',
      email: 'dev-manager@hms.local',
      role: 'MANAGER',
    });
    expect(me).toMatchObject({
      email: 'dev-manager@hms.local',
      fullName: 'Dev MANAGER',
    });
  });

  it('devAccounts(): ẩn ở production', async () => {
    await expect(service('production').devAccounts()).rejects.toThrow(
      NotFoundException,
    );
  });

  it('register(): tạo Customer chưa xác minh, email viết thường', async () => {
    const svc = service();
    await expect(
      svc.register('good', { fullName: 'Khách Mới', phone: '0912345678' }),
    ).resolves.toEqual({
      id: USER_ID,
      email: 'new@mail.vn',
      emailVerified: false,
    });
    expect(svc.users.create).toHaveBeenCalledWith({
      fullName: 'Khách Mới',
      phone: '0912345678',
      email: 'new@mail.vn',
      firebaseUid: 'uid-1',
      role: 'CUSTOMER',
      emailVerified: false,
    });
  });

  it('register(): email đã tồn tại thì 409, token sai thì 401', async () => {
    await expect(
      service('development', { _id: 'x' }).register('good', {
        fullName: 'A B',
      }),
    ).rejects.toThrow(ConflictException);
    await expect(
      service().register('bad', { fullName: 'A B' }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service().register(undefined, { fullName: 'A B' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
