import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CashPaymentService } from './cash-payment.service.js';
import { RecordCashPaymentDto } from './dto/cash-payment.dto.js';
import { BookingChargesResponse } from './dto/checkout-charge.dto.js';
import { CheckOutResult } from './dto/check-out.dto.js';
import { CheckOutService } from './check-out.service.js';

@ApiTags('invoices')
@Controller('bookings')
@Roles(Role.Receptionist, Role.Manager)
export class CheckOutController {
  constructor(
    private readonly cash: CashPaymentService,
    private readonly checkOuts: CheckOutService,
  ) {}

  @Post(':id/payments/cash')
  @ApiOperation({
    summary:
      'UC18 — Confirm the final payment was taken in cash at the desk (Receptionist/Manager)',
  })
  @ApiCreatedResponse({ type: BookingChargesResponse })
  @ApiConflictResponse({
    description:
      'Guest is not checked in, nothing is due, or a final payment is settled or pending',
  })
  recordCash(@Param('id') id: string, @Body() dto: RecordCashPaymentDto) {
    return this.cash.record(id, dto);
  }

  @Post(':id/check-out')
  @ApiOperation({
    summary:
      'UC18 — Check out a guest whose invoice is fully paid; rooms go to cleaning (Receptionist/Manager)',
  })
  @ApiCreatedResponse({ type: CheckOutResult })
  @ApiConflictResponse({
    description:
      'Guest is not checked in, money is still due, or a VNPay payment is pending',
  })
  checkOut(@Param('id') id: string) {
    return this.checkOuts.checkOut(id);
  }
}
