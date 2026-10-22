import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ProfileDto } from '../users/dto/profile.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** UC02: frontend gọi sau khi đăng nhập Firebase để kiểm tra tài khoản HMS và lấy role. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  /** UC01: gọi ngay sau khi tạo tài khoản Firebase, gửi kèm ID token của tài khoản đó. */
  @Public()
  @Post('register')
  register(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: ProfileDto,
  ) {
    return this.auth.register(authorization?.replace(/^Bearer /i, ''), dto);
  }

  @Public()
  @Get('dev-accounts')
  devAccounts() {
    return this.auth.devAccounts();
  }
}
