import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsModule } from '../rooms/rooms.module.js';
import { ServicesModule } from '../services/services.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AmenitiesModule } from '../amenities/amenities.module.js';
import { BedTypesModule } from '../bed-types/bed-types.module.js';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from '../payments/schemas/payment-transaction.schema.js';
import {
  RoomType,
  RoomTypeSchema,
} from '../room-types/schemas/room-type.schema.js';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { Booking, BookingSchema } from './schemas/booking.schema.js';
import { RoomHold, RoomHoldSchema } from './schemas/room-hold.schema.js';
import {
  HoldPrincipalLock,
  HoldPrincipalLockSchema,
} from './schemas/hold-principal-lock.schema.js';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';
import { RoomTypeOverviewController } from './room-type-overview.controller.js';
import { RoomTypeOverviewService } from './room-type-overview.service.js';
import {
  AvailabilityClock,
  AvailabilityRoomSource,
} from './availability.adapters.js';
import { MongoAvailabilityRoomSource } from './mongo-availability-room-source.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { GuestSessionMiddleware } from './guest-session.middleware.js';
import { HoldExpiryService } from './hold-expiry.service.js';
import { CheckInEvidenceStorage } from './check-in-evidence.storage.js';
import { CheckInService } from './check-in.service.js';
import { FrontDeskController } from './front-desk.controller.js';
import { FrontDeskService } from './front-desk.service.js';
import { RoomStatusBoardController } from './room-status-board.controller.js';
import { RoomStatusBoardService } from './room-status-board.service.js';

@Module({
  imports: [
    ConfigModule,
    RoomsModule,
    ServicesModule,
    NotificationsModule,
    AmenitiesModule,
    BedTypesModule,
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: RoomHold.name, schema: RoomHoldSchema },
      { name: HoldPrincipalLock.name, schema: HoldPrincipalLockSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
      // Chỉ đọc RoomType cho endpoint chi tiết phòng công khai; không sửa module RoomType.
      { name: RoomType.name, schema: RoomTypeSchema },
      // Chỉ đọc hoá đơn (H7) để trả tóm tắt thanh toán cho khách; không ghi từ module này.
      { name: Invoice.name, schema: InvoiceSchema },
      // Chỉ đọc User để liên kết booking vãng lai với tài khoản Customer cùng email.
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [
    AvailabilityController,
    RoomTypeOverviewController,
    BookingsController,
    RoomStatusBoardController,
    FrontDeskController,
  ],
  providers: [
    AvailabilityService,
    AvailabilityClock,
    RoomTypeOverviewService,
    BookingsService,
    HoldExpiryService,
    RoomStatusBoardService,
    FrontDeskService,
    CheckInService,
    CheckInEvidenceStorage,
    {
      provide: AvailabilityRoomSource,
      useClass: MongoAvailabilityRoomSource,
    },
  ],
  exports: [
    MongooseModule,
    AvailabilityService,
    AvailabilityRoomSource,
    AvailabilityClock,
    FrontDeskService,
    RoomStatusBoardService,
    BookingsService,
  ],
})
export class BookingsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(GuestSessionMiddleware).forRoutes(BookingsController);
  }
}
