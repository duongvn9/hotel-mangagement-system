import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PaymentMethod } from '../payments/schemas/payment-transaction.schema.js';
import { DeskDepositService } from './desk-deposit.service.js';
import { RecordDeskDepositDto } from './dto/desk-deposit.dto.js';
import { BookingChargesResponse } from './dto/checkout-charge.dto.js';

@ApiTags('invoices')
@Controller('bookings')
@Roles(Role.Receptionist, Role.Manager)
export class DeskDepositController {
  constructor(private readonly deposits: DeskDepositService) {}

  @Post(':id/payments/deposit')
  @ApiOperation({
    summary:
      'Take the booking deposit at the desk, by cash or card (Receptionist/Manager)',
  })
  @ApiCreatedResponse({ type: BookingChargesResponse })
  @ApiConflictResponse({
    description:
      'Booking is not confirmed, the deposit is already paid or pending, or the request id was used for another payment',
  })
  record(@Param('id') id: string, @Body() dto: RecordDeskDepositDto) {
    return this.deposits.record(
      id,
      dto,
      dto.method === 'CARD' ? PaymentMethod.Card : PaymentMethod.Cash,
    );
  }
}
