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
import { FeedbackModule } from './modules/feedback/feedback.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { InvoicesModule } from './modules/invoices/invoices.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PaymentsApiModule } from './modules/payments/payments-api.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { AmenitiesModule } from './modules/amenities/amenities.module.js';
import { RoomTypesModule } from './modules/room-types/room-types.module.js';
import { RoomsModule } from './modules/rooms/rooms.module.js';
import { IssuesModule } from './modules/issues/issues.module.js';

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
    FeedbackModule,
    IssuesModule,
    BookingsModule,
    InvoicesModule,
    PaymentsModule,
    PaymentsApiModule,
    TasksModule,
    AmenitiesModule,
    RoomTypesModule,
    RoomsModule,
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
