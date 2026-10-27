import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

/** UC40: tìm theo nội dung, tên hoặc email khách; lọc theo số sao, đã trả lời hay chưa. */
export class ListFeedbackQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  replied?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

/** UC41 Reply to Feedback. */
export class ReplyFeedbackDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 2000, { message: 'Nội dung trả lời phải từ 1 đến 2000 ký tự' })
  content: string;
}

/** UC39 Submit Feedback: phản hồi cho một lần lưu trú đã trả phòng (BR-FB-01..03). */
export class SubmitFeedbackDto {
  @ApiProperty({ description: 'Booking (lần lưu trú) được phản hồi' })
  @IsMongoId()
  bookingId: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 5,
    description: 'Điểm 1-5 sao, không bắt buộc',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiProperty({ maxLength: 2000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 2000, { message: 'Nội dung phản hồi phải từ 1 đến 2000 ký tự' })
  content: string;
}

export class SubmittedFeedback {
  id: string;
  bookingId: string;
  rating?: number;
  content: string;
  createdAt: string;
}

export class MyStayReply {
  content: string;
  repliedAt: string;
}

export class MyStayFeedback {
  id: string;
  rating?: number;
  content: string;
  createdAt: string;
  reply?: MyStayReply;
}

export class MyStay {
  bookingId: string;
  code: string;
  checkIn: string;
  checkOut: string;
  /** Phản hồi đã gửi cho lần lưu trú này, null nếu chưa gửi. */
  feedback: MyStayFeedback | null;
}

export class MyStaysResponse {
  items: MyStay[];
}
