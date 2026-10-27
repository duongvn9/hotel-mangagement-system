import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BookingStatus } from '../schemas/booking.schema.js';

const toInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListBookingsQuery {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    description:
      'Literal search on booking code, guest name, email or phone (case insensitive)',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiPropertyOptional({
    description: 'Check-in on or after this day (YYYY-MM-DD, giờ Việt Nam)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkInFrom must be YYYY-MM-DD' })
  checkInFrom?: string;

  @ApiPropertyOptional({
    description: 'Check-in on or before this day (YYYY-MM-DD, giờ Việt Nam)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkInTo must be YYYY-MM-DD' })
  checkInTo?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 10000 })
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class BookingListRoom {
  id: string;
  roomNumber?: string;
  roomTypeName?: string;
}

export class BookingListItem {
  id: string;
  code: string;
  status: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  rooms: BookingListRoom[];
  checkIn: string;
  checkOut: string;
  guests: number;
  roomTotal: number;
  createdAt: string;
  /** true nếu booking do nhân viên tạo tại quầy (UC08). */
  walkIn: boolean;
}

export class BookingListResponse {
  items: BookingListItem[];
  total: number;
  page: number;
  limit: number;
}
