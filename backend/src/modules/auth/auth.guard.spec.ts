import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Model } from 'mongoose';
import type { User } from '../users/schemas/user.schema.js';
import { AuthGuard } from './auth.guard.js';
import type { IdTokenVerifier } from './firebase.module.js';

const DB_USER = {
  _id: '6718a1b2c3d4e5f601234567',
  email: 'manager@hms.local',
  role: 'MANAGER',
  isActive: true,
  emailVerified: true,
};

function setup({
  isPublic = false,
  token = { uid: 'uid-1', email: 'Manager@HMS.local', email_verified: true },
  byUid = DB_USER as object | null,
  byEmail = null as object | null,
} = {}) {
  const lean = (value: unknown) => ({ lean: () => Promise.resolve(value) });
  const users = {
    findOne: vi.fn(() => lean(byUid)),
    findOneAndUpdate: vi.fn(() => lean(byEmail)),
    updateOne: vi.fn(),
  };
  const verifier: IdTokenVerifier = {
    verifyIdToken: vi.fn((t: string) =>
      t === 'good'
        ? Promise.resolve(token as any)
        : Promise.reject(new Error()),
    ),
  };
  const reflector = {
    getAllAndOverride: () => isPublic,
  } as unknown as Reflector;
  const guard = new AuthGuard(
    reflector,
    verifier,
    users as unknown as Model<User>,
  );

  const run = (headers: Record<string, string>, user?: Request['user']) => {
    const req = { header: (n: string) => headers[n], user } as Request;
    const ctx = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return guard.canActivate(ctx).then((ok) => ({ ok, user: req.user }));
  };
  return { run, users, verifier };
}

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

describe('AuthGuard', () => {
  it('giữ req.user do DevAuthMiddleware gắn', async () => {
    const { run, verifier } = setup();
    const dev = { id: 'x', email: 'dev@hms.local', role: 'MANAGER' };
    await expect(run({}, dev)).resolves.toEqual({ ok: true, user: dev });
    expect(verifier.verifyIdToken).not.toHaveBeenCalled();
  });

  it('không có token: 401, trừ endpoint @Public()', async () => {
    await expect(setup().run({})).rejects.toThrow(UnauthorizedException);
    await expect(setup({ isPublic: true }).run({})).resolves.toEqual({
      ok: true,
      user: undefined,
    });
  });

  it('token sai: 401, endpoint @Public() thì coi như khách', async () => {
    await expect(setup().run(bearer('bad'))).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(
      setup({ isPublic: true }).run(bearer('bad')),
    ).resolves.toMatchObject({ ok: true, user: undefined });
  });

  it('token hợp lệ: gắn user theo firebaseUid', async () => {
    await expect(setup().run(bearer('good'))).resolves.toEqual({
      ok: true,
      user: { id: DB_USER._id, email: DB_USER.email, role: 'MANAGER' },
    });
  });

  it('email chưa xác minh: 403 và không nối tài khoản theo email', async () => {
    const { run, users } = setup({
      token: {
        uid: 'uid-1',
        email: 'manager@hms.local',
        email_verified: false,
      },
      byUid: null,
    });
    await expect(run(bearer('good'))).rejects.toThrow(ForbiddenException);
    expect(users.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('chưa có firebaseUid: nối theo email viết thường', async () => {
    const { run, users } = setup({ byUid: null, byEmail: DB_USER });
    await expect(run(bearer('good'))).resolves.toMatchObject({ ok: true });
    expect(users.findOneAndUpdate).toHaveBeenCalledWith(
      { email: 'manager@hms.local', firebaseUid: { $exists: false } },
      { $set: { firebaseUid: 'uid-1', emailVerified: true } },
      { new: true },
    );
  });

  it('chưa có tài khoản HMS: 401', async () => {
    await expect(setup({ byUid: null }).run(bearer('good'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('tài khoản bị khoá: 403', async () => {
    await expect(
      setup({ byUid: { ...DB_USER, isActive: false } }).run(bearer('good')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('đồng bộ emailVerified về DB khi Firebase đã xác minh', async () => {
    const { run, users } = setup({
      byUid: { ...DB_USER, emailVerified: false },
    });
    await run(bearer('good'));
    expect(users.updateOne).toHaveBeenCalledWith(
      { _id: DB_USER._id },
      { emailVerified: true },
    );
  });
});
