import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsMongoId,
  IsIn,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ServiceOrderExecutionStatus,
  ServiceOrderReviewStatus,
} from '../service-order-status.js';

const optional = (_object: unknown, value: unknown) => value !== undefined;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const integer = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class CreateServiceOrderDto {
  @IsMongoId()
  bookingId: string;

  @IsMongoId()
  serviceId: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  quantity: number;

  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  requestedTime?: string;

  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ValidateIf(optional)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID()
  requestId?: string;
}

export class ReviewServiceOrderDto {
  @IsIn(['ACCEPT', 'REJECT'])
  decision: 'ACCEPT' | 'REJECT';

  @ValidateIf(
    (object: ReviewServiceOrderDto, value: unknown) =>
      object.decision === 'REJECT' || value !== undefined,
  )
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class AssignServiceOrderDto {
  @IsMongoId()
  assigneeId: string;

  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  dueAt?: string;
}

export class ServiceHistoryQuery {
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  from?: string;

  @ValidateIf(optional)
  @IsISO8601({ strict: true, strictSeparator: true })
  to?: string;

  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class ListServiceOrdersQuery {
  @ValidateIf(optional)
  @IsEnum(ServiceOrderReviewStatus)
  reviewStatus?: ServiceOrderReviewStatus;

  @ValidateIf(optional)
  @IsEnum(ServiceOrderExecutionStatus)
  executionStatus?: ServiceOrderExecutionStatus;

  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
