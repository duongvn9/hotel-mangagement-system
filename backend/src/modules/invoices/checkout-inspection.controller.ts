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
import { CheckoutInspectionService } from './checkout-inspection.service.js';
import {
  CheckoutInspectionResponse,
  CheckoutInspectionView,
  InspectorListResponse,
  RequestCheckoutInspectionDto,
} from './dto/checkout-inspection.dto.js';

@ApiTags('invoices')
@Controller('bookings')
@Roles(Role.Receptionist, Role.Manager)
export class CheckoutInspectionController {
  constructor(private readonly inspections: CheckoutInspectionService) {}

  @Post(':id/checkout-inspection')
  @ApiOperation({
    summary:
      'Ask service staff to inspect the room and services before check-out (Receptionist/Manager)',
  })
  @ApiCreatedResponse({ type: CheckoutInspectionView })
  @ApiConflictResponse({
    description: 'Guest is not checked in, or an inspection is already open',
  })
  request(@Param('id') id: string, @Body() dto: RequestCheckoutInspectionDto) {
    return this.inspections.request(id, dto);
  }

  @Get(':id/checkout-inspection')
  @ApiOperation({
    summary:
      'Latest check-out inspection of a booking and the staff result (Receptionist/Manager)',
  })
  @ApiOkResponse({ type: CheckoutInspectionResponse })
  current(@Param('id') id: string) {
    return this.inspections.current(id);
  }
}

@ApiTags('invoices')
@Controller('front-desk')
@Roles(Role.Receptionist, Role.Manager)
export class InspectorsController {
  constructor(private readonly inspections: CheckoutInspectionService) {}

  @Get('inspectors')
  @ApiOperation({
    summary:
      'Active service staff who can be asked to inspect a room (Receptionist/Manager)',
  })
  @ApiOkResponse({ type: InspectorListResponse })
  inspectors() {
    return this.inspections.inspectors();
  }
}
