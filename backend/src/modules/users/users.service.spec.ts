import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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
const USER = {
  _id: ID,
  email: 'staff@hms.vn',
  fullName: 'Nhân Viên Mới',
  role: 'RECEPTIONIST',
  isActive: true,
  emailVerified: true,
  firebaseUid: 'fb-uid',
};

function setup({
  roleExists = true,
  emailExists = false,
  createFails = false,
  user = USER,
}: {
  roleExists?: boolean;
  emailExists?: boolean;
  createFails?: boolean;
  user?: (Omit<typeof USER, 'firebaseUid'> & { firebaseUid?: string }) | null;
} = {}) {
  const users = {
    exists: vi.fn(() => Promise.resolve(emailExists ? { _id: ID } : null)),
    create: vi.fn((doc: object) =>
      createFails
        ? Promise.reject(Object.assign(new Error(), { code: 11000 }))
        : Promise.resolve({ toObject: () => ({ _id: ID, ...doc }) }),
    ),
    findById: vi.fn(() => ({
      lean: () => Promise.resolve(user),
    })),
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
    updateUser: vi.fn(() => Promise.resolve()),
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

  it('số điện thoại rỗng thì xoá số', async () => {
    const { service, users } = setup();
    await service.update(ID, { phone: '', fullName: 'Tên' }, 'manager-id');
    expect(users.findByIdAndUpdate).toHaveBeenCalledWith(
      ID,
      { $set: { fullName: 'Tên' }, $unset: { phone: 1 } },
      { new: true, runValidators: true },
    );
  });
});

describe('UsersService.changePassword (UC43)', () => {
  it('đặt mật khẩu mới qua Firebase cho tài khoản khác', async () => {
    const { service, firebase } = setup();
    const account = await service.changePassword(
      ID,
      { newPassword: 'newpass12' },
      'manager-id',
    );

    expect(firebase.updateUser).toHaveBeenCalledWith('fb-uid', {
      password: 'newpass12',
    });
    expect(account).toMatchObject({ id: ID, email: 'staff@hms.vn' });
  });

  it('không cho tự đổi mật khẩu ở trang quản lý tài khoản', async () => {
    const { service, users, firebase } = setup();
    await expect(
      service.changePassword(ID, { newPassword: 'newpass12' }, ID),
    ).rejects.toThrow(BadRequestException);
    expect(users.findById).not.toHaveBeenCalled();
    expect(firebase.updateUser).not.toHaveBeenCalled();
  });

  it.each(['6718A1B2C3D4E5F601234567', '6718a1B2c3D4e5F601234567'])(
    'rejects self password changes with differently cased ID %s',
    async (targetId) => {
      const { service, users, firebase } = setup();
      await expect(
        service.changePassword(targetId, { newPassword: 'newpass12' }, ID),
      ).rejects.toThrow(BadRequestException);
      expect(users.findById).not.toHaveBeenCalled();
      expect(firebase.updateUser).not.toHaveBeenCalled();
    },
  );

  it('tài khoản chưa liên kết Firebase: 400', async () => {
    const { service, firebase } = setup({
      user: { ...USER, firebaseUid: undefined },
    });
    await expect(
      service.changePassword(ID, { newPassword: 'newpass12' }, 'manager-id'),
    ).rejects.toThrow(BadRequestException);
    expect(firebase.updateUser).not.toHaveBeenCalled();
  });

  it('id sai hoặc không tồn tại: 404', async () => {
    const { service } = setup({ user: null });
    await expect(
      service.changePassword(ID, { newPassword: 'newpass12' }, 'manager-id'),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.changePassword(
        'khong-phai-id',
        { newPassword: 'newpass12' },
        'manager-id',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
