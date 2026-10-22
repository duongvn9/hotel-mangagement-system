import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module.js';
import { AuthGuard } from './auth.guard.js';
import { firebaseVerifierProvider } from './firebase.provider.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [UsersModule],
  providers: [
    firebaseVerifierProvider,
    // Thứ tự đăng ký = thứ tự chạy: xác thực trước, phân quyền sau.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [firebaseVerifierProvider],
})
export class AuthModule {}
