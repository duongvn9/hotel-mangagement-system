import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CheckoutChargesService } from './checkout-charges.service.js';
import {
  AddCheckoutChargeDto,
  BookingChargesResponse,
} from './dto/checkout-charge.dto.js';

@ApiTags('invoices')
@Controller('bookings')
@Roles(Role.Receptionist, Role.Manager)
export class CheckoutChargesController {
  constructor(private readonly charges: CheckoutChargesService) {}

  @Post(':id/charges')
  @ApiOperation({
    summary:
      'UC17 — Record an additional charge for a checked-in guest (Receptionist/Manager)',
  })
  @ApiCreatedResponse({ type: BookingChargesResponse })
  @ApiConflictResponse({
    description:
      'Guest is not checked in, or the request id was already used with different content',
  })
  add(@Param('id') id: string, @Body() dto: AddCheckoutChargeDto) {
    return this.charges.add(id, dto);
  }

  @Get(':id/charges')
  @ApiOperation({
    summary:
      "UC17 — List a booking's charges and invoice totals (Receptionist/Manager)",
  })
  @ApiOkResponse({ type: BookingChargesResponse })
  list(@Param('id') id: string) {
    return this.charges.list(id);
  }
}
