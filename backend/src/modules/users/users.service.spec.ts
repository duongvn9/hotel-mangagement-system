import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { FirebaseUserAdmin } from '../auth/firebase.module.js';
import type { Role } from '../roles/schemas/role.schema.js';
import type { User } from './schemas/user.schema.js';
import { UsersService } from './users.service.js';

const ID = '6718a1b2c3d4e5f601234567';
const DTO = {
  email: 'Staff@HMS.vn',
  fullName: 'Nhân Viên Mới',
  role: 'RECEPTIONIST',
  password: 'secret12',
};

function setup({
  roleExists = true,
  emailExists = false,
  createFails = false,
} = {}) {
  const users = {
    exists: vi.fn(() => Promise.resolve(emailExists ? { _id: ID } : null)),
    create: vi.fn((doc: object) =>
      createFails
        ? Promise.reject(Object.assign(new Error(), { code: 11000 }))
        : Promise.resolve({ toObject: () => ({ _id: ID, ...doc }) }),
    ),
    findByIdAndUpdate: vi.fn(() => ({
      lean: () => Promise.resolve({ _id: ID, ...DTO }),
    })),
  };
  const roles = {
    exists: vi.fn(() => Promise.resolve(roleExists ? { _id: 'r' } : null)),
  };
  const firebase: FirebaseUserAdmin = {
    createUser: vi.fn(() => Promise.resolve('fb-uid')),
    deleteUser: vi.fn(() => Promise.resolve()),
  };
  const service = new UsersService(
    users as unknown as Model<User>,
    roles as unknown as Model<Role>,
    firebase,
  );
  return { service, users, firebase };
}

describe('UsersService.create (UC43)', () => {
  it('tạo tài khoản Firebase rồi lưu User đã xác minh, email viết thường', async () => {
    const { service, users, firebase } = setup();
    const account = await service.create(DTO);

    expect(firebase.createUser).toHaveBeenCalledWith({
      email: 'staff@hms.vn',
      password: 'secret12',
      displayName: 'Nhân Viên Mới',
    });
    expect(users.create).toHaveBeenCalledWith({
      email: 'staff@hms.vn',
      fullName: 'Nhân Viên Mới',
      role: 'RECEPTIONIST',
      firebaseUid: 'fb-uid',
      emailVerified: true,
    });
    expect(account).toMatchObject({ id: ID, hasFirebaseAccount: true });
  });

  it('role không tồn tại: 400; email trùng: 409', async () => {
    await expect(
      setup({ roleExists: false }).service.create(DTO),
    ).rejects.toThrow(BadRequestException);
    await expect(
      setup({ emailExists: true }).service.create(DTO),
    ).rejects.toThrow(ConflictException);
  });

  it('lưu User lỗi thì xoá tài khoản Firebase vừa tạo', async () => {
    const { service, firebase } = setup({ createFails: true });
    await expect(service.create(DTO)).rejects.toThrow(ConflictException);
    expect(firebase.deleteUser).toHaveBeenCalledWith('fb-uid');
  });
});

describe('UsersService.update (UC43)', () => {
  it('không tự khoá hoặc tự đổi role của chính mình', async () => {
    const { service, users } = setup();
    await expect(service.update(ID, { isActive: false }, ID)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update(ID, { role: 'CUSTOMER' }, ID)).rejects.toThrow(
      BadRequestException,
    );
    expect(users.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('khoá tài khoản người khác', async () => {
    const { service, users } = setup();
    await service.update(ID, { isActive: false }, 'manager-id');
    expect(users.findByIdAndUpdate).toHaveBeenCalledWith(
      ID,
      { $set: { isActive: false } },
      { new: true, runValidators: true },
    );
  });
});
