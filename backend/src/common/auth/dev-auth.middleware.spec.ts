import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { DEV_USER_ID, DevAuthMiddleware } from './dev-auth.middleware.js';

const USER_ID = '6718a1b2c3d4e5f601234567';

function run(env: string, headers: Record<string, string>) {
  const config = { get: () => env } as unknown as ConfigService<any, true>;
  const req = { header: (name: string) => headers[name] } as Request;
  const next = vi.fn();
  new DevAuthMiddleware(config).use(req, {} as Response, next);
  expect(next).toHaveBeenCalledOnce();
  return req.user;
}

describe('DevAuthMiddleware', () => {
  it('không gửi header thì không gắn user', () => {
    expect(run('development', {})).toBeUndefined();
  });

  it('chỉ gửi role thì dùng DEV_USER_ID', () => {
    expect(run('development', { 'x-dev-role': 'MANAGER' })).toEqual({
      id: DEV_USER_ID,
      email: 'dev-manager@hms.local',
      role: 'MANAGER',
    });
  });

  it('chỉ gửi user id thì role mặc định CUSTOMER', () => {
    expect(run('test', { 'x-dev-user-id': USER_ID })).toMatchObject({
      id: USER_ID,
      role: 'CUSTOMER',
    });
  });

  it('bỏ qua header ở production', () => {
    expect(run('production', { 'x-dev-role': 'MANAGER' })).toBeUndefined();
  });

  it('role sai thì báo 400', () => {
    expect(() => run('development', { 'x-dev-role': 'ADMIN' })).toThrow(
      BadRequestException,
    );
  });

  it('user id không phải ObjectId thì báo 400', () => {
    expect(() => run('development', { 'x-dev-user-id': '123' })).toThrow(
      BadRequestException,
    );
  });
});
