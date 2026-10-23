import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';
import type { AppConfig } from '../../config/configuration.js';
import { vnpayConfigSchema } from '../../config/vnpay.config.js';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  type PaymentTransaction,
} from './schemas/payment-transaction.schema.js';
import {
  amountToVnpay,
  canonicalize,
  parseVietnamTimestamp,
  signVnpay,
  verifyVnpayQuery,
  vietnamTimestamp,
  VnpayValidationError,
} from './vnpay.protocol.js';

export interface ExpectedVnpayPayment {
  payment: Readonly<PaymentTransaction>;
  booking: { id: string; isActive: boolean };
  invoice: { id: string; bookingId: string; isActive: boolean };
}

export interface VnpayRequestOptions {
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
  locale?: 'vn' | 'en';
  bankCode?: string;
}

export interface VerifiedVnpayResult {
  transactionRef: string;
  providerTransactionRef: string;
  amount: number;
  status: PaymentStatus;
  responseCode: string;
  transactionStatus: string;
  paidAt?: Date;
}

export type VnpayIpnPlan =
  | { action: 'duplicate'; result: VerifiedVnpayResult }
  | { action: 'review'; result: VerifiedVnpayResult }
  | {
      action: 'compare-and-set';
      expectedStatus: PaymentStatus.Pending;
      result: VerifiedVnpayResult;
    };

export abstract class VnpaySettlementPort {
  abstract commitAtomically(
    expected: ExpectedVnpayPayment,
    plan: Extract<VnpayIpnPlan, { action: 'compare-and-set' }>,
  ): Promise<'committed' | 'duplicate' | 'conflict'>;
}

export function paymentOrderInfo(
  payment: Readonly<PaymentTransaction>,
): string {
  return `HMS ${payment.purpose} ${payment.transactionRef}`;
}

@Injectable()
export class VnpayService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<AppConfig>,
  ) {}

  private settings() {
    const settings = this.config.get<AppConfig['vnpay']>('vnpay');
    if (
      !settings ||
      vnpayConfigSchema.validate(settings, { convert: false }).error
    ) {
      throw new ServiceUnavailableException('VNPay sandbox is not configured');
    }
    return settings;
  }

  private validateExpected(expected: ExpectedVnpayPayment): void {
    const { payment, booking, invoice } = expected;
    if (
      !payment.isActive ||
      !booking.isActive ||
      !invoice.isActive ||
      !/^[a-f\d]{24}$/i.test(booking.id) ||
      !/^[a-f\d]{24}$/i.test(invoice.id) ||
      String(payment.booking) !== booking.id ||
      String(payment.invoice) !== invoice.id ||
      invoice.bookingId !== booking.id ||
      payment.method !== PaymentMethod.Vnpay ||
      !Object.values(PaymentPurpose).includes(payment.purpose) ||
      !Object.values(PaymentStatus).includes(payment.status) ||
      !/^[A-Za-z0-9]{1,100}$/.test(payment.transactionRef)
    ) {
      throw new VnpayValidationError('relationship');
    }
    amountToVnpay(payment.amount);
  }

  createPaymentUrl(
    expected: ExpectedVnpayPayment,
    options: VnpayRequestOptions,
  ): string {
    const settings = this.settings();
    this.validateExpected(expected);
    if (
      expected.payment.status !== PaymentStatus.Pending ||
      expected.payment.providerTransactionRef ||
      expected.payment.paidAt
    ) {
      throw new VnpayValidationError('conflict');
    }
    const created = vietnamTimestamp(options.createdAt);
    const expires = vietnamTimestamp(options.expiresAt);
    if (
      expires <= created ||
      !isIP(options.ipAddress) ||
      options.ipAddress.length < 7 ||
      (options.locale !== undefined &&
        !['vn', 'en'].includes(options.locale)) ||
      (options.bankCode !== undefined &&
        !/^[A-Za-z0-9]{3,20}$/.test(options.bankCode))
    ) {
      throw new VnpayValidationError('fields');
    }
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: settings.tmnCode,
      vnp_Amount: amountToVnpay(expected.payment.amount),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: expected.payment.transactionRef,
      vnp_OrderInfo: paymentOrderInfo(expected.payment),
      vnp_OrderType: 'other',
      vnp_Locale: options.locale ?? 'vn',
      vnp_IpAddr: options.ipAddress,
      vnp_ReturnUrl: settings.returnUrl,
      vnp_CreateDate: created,
      vnp_ExpireDate: expires,
      ...(options.bankCode === undefined
        ? {}
        : { vnp_BankCode: options.bankCode }),
    };
    return `${settings.paymentUrl}?${canonicalize(params)}&vnp_SecureHash=${signVnpay(params, settings.hashSecret)}`;
  }

  verifyReturn(
    rawQuery: string,
    expected: ExpectedVnpayPayment,
  ): VerifiedVnpayResult {
    const settings = this.settings();
    const fields = verifyVnpayQuery(rawQuery, settings.hashSecret);
    this.validateExpected(expected);
    const patterns: Record<string, RegExp> = {
      vnp_TmnCode: /^[A-Za-z0-9]{8}$/,
      vnp_Amount: /^[1-9]\d{0,11}$/,
      vnp_BankCode: /^[A-Za-z0-9]{3,20}$/,
      vnp_OrderInfo: /^[A-Za-z0-9 ]{1,255}$/,
      vnp_TransactionNo: /^\d{1,15}$/,
      vnp_ResponseCode: /^\d{2}$/,
      vnp_TransactionStatus: /^\d{2}$/,
      vnp_TxnRef: /^[A-Za-z0-9]{1,100}$/,
    };
    if (
      Object.entries(patterns).some(
        ([key, pattern]) => !fields[key] || !pattern.test(fields[key]),
      ) ||
      (fields.vnp_BankTranNo !== undefined &&
        !/^[A-Za-z0-9]{1,255}$/.test(fields.vnp_BankTranNo)) ||
      (fields.vnp_CardType !== undefined &&
        !/^[A-Za-z]{2,20}$/.test(fields.vnp_CardType))
    ) {
      throw new VnpayValidationError('fields');
    }
    if (
      fields.vnp_TmnCode !== settings.tmnCode ||
      fields.vnp_TxnRef !== expected.payment.transactionRef ||
      fields.vnp_OrderInfo !== paymentOrderInfo(expected.payment)
    )
      throw new VnpayValidationError('relationship');
    if (fields.vnp_Amount !== amountToVnpay(expected.payment.amount))
      throw new VnpayValidationError('amount');
    const success =
      fields.vnp_ResponseCode === '00' && fields.vnp_TransactionStatus === '00';
    const paidAt =
      fields.vnp_PayDate === undefined
        ? undefined
        : parseVietnamTimestamp(fields.vnp_PayDate);
    if (success && (!paidAt || /^0+$/.test(fields.vnp_TransactionNo)))
      throw new VnpayValidationError('fields');
    if (
      expected.payment.providerTransactionRef !== undefined &&
      expected.payment.providerTransactionRef !== fields.vnp_TransactionNo
    ) {
      throw new VnpayValidationError('conflict');
    }
    return {
      transactionRef: fields.vnp_TxnRef,
      providerTransactionRef: fields.vnp_TransactionNo,
      amount: expected.payment.amount,
      status: success
        ? PaymentStatus.Success
        : fields.vnp_ResponseCode === '24'
          ? PaymentStatus.Cancelled
          : PaymentStatus.Failed,
      responseCode: fields.vnp_ResponseCode,
      transactionStatus: fields.vnp_TransactionStatus,
      ...(paidAt === undefined ? {} : { paidAt }),
    };
  }

  prepareIpn(rawQuery: string, expected: ExpectedVnpayPayment): VnpayIpnPlan {
    const result = this.verifyReturn(rawQuery, expected);
    const payment = expected.payment;
    if (payment.status !== PaymentStatus.Pending) {
      if (
        payment.status !== result.status ||
        payment.providerTransactionRef !== result.providerTransactionRef ||
        (payment.status === PaymentStatus.Success &&
          payment.paidAt?.getTime() !== result.paidAt?.getTime())
      ) {
        throw new VnpayValidationError('conflict');
      }
      return { action: 'duplicate', result };
    }
    if (payment.providerTransactionRef || payment.paidAt)
      throw new VnpayValidationError('conflict');
    if (
      result.status !== PaymentStatus.Success &&
      (result.responseCode === '00' ||
        result.transactionStatus !== '02' ||
        ![
          '09',
          '10',
          '11',
          '12',
          '13',
          '24',
          '51',
          '65',
          '75',
          '79',
          '99',
        ].includes(result.responseCode))
    ) {
      return { action: 'review', result };
    }
    return {
      action: 'compare-and-set',
      expectedStatus: PaymentStatus.Pending,
      result,
    };
  }
}
