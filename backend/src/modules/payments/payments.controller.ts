import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  InitiatePaymentDto,
  PaymentInitiationResponse,
  PaymentReturnResponse,
} from './dto/initiate-payment.dto.js';
import {
  ReconciledPaymentResponse,
  ReconciliationListResponse,
  ReconcilePaymentDto,
} from './dto/reconcile-payment.dto.js';
import { PaymentsService, type InitiateOptions } from './payments.service.js';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('deposit')
  @Public()
  @ApiOperation({
    summary:
      'UC20 — Initiate a VNPay deposit (owner, staff, or Guest with code)',
  })
  @ApiCreatedResponse({ type: PaymentInitiationResponse })
  @ApiUnauthorizedResponse()
  initiateDeposit(
    @Body() dto: InitiatePaymentDto,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    return this.payments.initiateDeposit(
      dto.bookingId,
      this.actor(dto, user),
      this.options(dto, req),
    );
  }

  @Post('final')
  @Public()
  @ApiOperation({
    summary:
      'UC21 — Initiate a VNPay final payment (owner, staff, or Guest code)',
  })
  @ApiCreatedResponse({ type: PaymentInitiationResponse })
  @ApiUnauthorizedResponse()
  initiateFinal(
    @Body() dto: InitiatePaymentDto,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    return this.payments.initiateFinal(
      dto.bookingId,
      this.actor(dto, user),
      this.options(dto, req),
    );
  }

  @Get('vnpay/return')
  @Public()
  @ApiOperation({ summary: 'Verify a VNPay return redirect (read-only)' })
  @ApiOkResponse({ type: PaymentReturnResponse })
  verifyReturn(@Req() req: Request) {
    return this.payments.verifyReturn(this.rawQuery(req));
  }

  @Get('vnpay/ipn')
  @Public()
  @ApiOperation({ summary: 'VNPay IPN callback (durable settlement)' })
  processIpn(@Req() req: Request) {
    return this.payments.processIpn(this.rawQuery(req));
  }

  @Get('reconciliation')
  @Roles(Role.Manager)
  @ApiOperation({
    summary:
      'List deposits that settled after their hold lapsed and need manual reconciliation (Manager)',
  })
  @ApiOkResponse({ type: ReconciliationListResponse })
  listReconciliation() {
    return this.payments.listReconciliation();
  }

  @Post(':id/reconcile')
  @Roles(Role.Manager)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Mark a flagged payment as reconciled with a note after handling it (Manager)',
  })
  @ApiOkResponse({ type: ReconciledPaymentResponse })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiConflictResponse({ description: 'Payment does not need reconciliation' })
  reconcile(
    @Param('id') id: string,
    @Body() dto: ReconcilePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.reconcile(id, user.id, dto.note);
  }

  private actor(dto: InitiatePaymentDto, user: AuthUser | undefined) {
    return {
      ...(user ? { user } : {}),
      ...(dto.code === undefined ? {} : { code: dto.code }),
    };
  }

  private options(dto: InitiatePaymentDto, req: Request): InitiateOptions {
    return {
      ipAddress: this.clientIp(req),
      ...(dto.locale === undefined ? {} : { locale: dto.locale }),
      ...(dto.bankCode === undefined ? {} : { bankCode: dto.bankCode }),
    };
  }

  private rawQuery(req: Request): string {
    const index = req.originalUrl.indexOf('?');
    return index >= 0 ? req.originalUrl.slice(index + 1) : '';
  }

  private clientIp(req: Request): string {
    const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
    return forwarded || req.ip || '';
  }
}
