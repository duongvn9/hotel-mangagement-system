import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { GuestSessionRequest } from './guest-session.middleware.js';

export interface GuestSessionContext {
  sessionId?: string;
  clientIp?: string;
}

/** Lấy phiên khách (sessionId, clientIp) mà GuestSessionMiddleware đã gắn vào request. */
export const GuestSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GuestSessionContext => {
    const req = ctx.switchToHttp().getRequest<GuestSessionRequest>();
    return { sessionId: req.guestSessionId, clientIp: req.guestClientIp };
  },
);
