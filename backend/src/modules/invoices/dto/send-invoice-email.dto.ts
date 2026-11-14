import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class SendInvoiceEmailDto {
  @ApiPropertyOptional({
    description:
      'Email recipient for the receipt; falls back to guestEmail on the booking',
    example: 'guest@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
