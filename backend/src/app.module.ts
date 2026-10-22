import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { DevAuthMiddleware } from './common/auth/dev-auth.middleware.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { configuration, type AppConfig } from './config/configuration.js';
import { envValidationSchema } from './config/env.validation.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        uri: config.get('mongo.uri', { infer: true }),
        autoIndex: config.get('env', { infer: true }) !== 'production',
      }),
    }),
    HealthModule,
    UsersModule,
    RolesModule,
    AuthModule,
    // Module nghiệp vụ thêm vào đây, xem src/modules/README.md
  ],
  // Khai báo ở đây (không dùng app.useGlobal* trong main.ts) để test e2e cũng có.
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(DevAuthMiddleware).forRoutes('{*splat}');
  }
}
