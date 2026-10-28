import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/** Request có thêm thông tin phiên khách do middleware gắn. */
export interface GuestSessionRequest extends Request {
  guestSessionId?: string;
  guestClientIp?: string;
}

const COOKIE = 'hms_sid';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const VALID = /^[A-Za-z0-9_-]{16,}$/;

function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name)
      return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

/**
 * Cấp/đọc cookie phiên khách `hms_sid` (HttpOnly, SameSite=Lax, Secure ở production)
 * để nhận diện lượt giữ phòng của Guest cho cơ chế chống lạm dụng. Không thay thế
 * chống đặt trùng an toàn ở DB.
 */
@Injectable()
export class GuestSessionMiddleware implements NestMiddleware {
  use(req: GuestSessionRequest, res: Response, next: NextFunction): void {
    let sid = readCookie(req.headers.cookie, COOKIE);
    if (!sid || !VALID.test(sid)) {
      sid = randomBytes(24).toString('base64url');
      res.cookie(COOKIE, sid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: MAX_AGE_MS,
        path: '/',
      });
    }
    req.guestSessionId = sid;
    const forwarded = req.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0];
    req.guestClientIp =
      first?.trim() || req.ip || req.socket?.remoteAddress || undefined;
    next();
  }
}
