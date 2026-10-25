import { Transform } from 'class-transformer';
import {
  IsMongoId,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ServiceTaskIssueDto {
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  category: string;

  @Transform(trim)
  @IsString()
  @Length(1, 5000)
  description: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsUUID()
  requestId?: string;
}

export class CreateIssueDto {
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  category: string;

  @Transform(trim)
  @IsString()
  @Length(1, 5000)
  description: string;

  @IsMongoId()
  bookingId: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsMongoId()
  roomId?: string;
}
