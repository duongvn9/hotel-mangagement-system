import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { createHmac } from 'node:crypto';
import { envValidationSchema } from '../../config/env.validation.js';
import { VNPAY_SANDBOX_URL } from '../../config/vnpay.config.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { RoomHold } from '../bookings/schemas/room-hold.schema.js';
import { Invoice } from '../invoices/schemas/invoice.schema.js';
import { PaymentsModule } from './payments.module.js';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PaymentTransaction,
} from './schemas/payment-transaction.schema.js';
import { VnpayService, type ExpectedVnpayPayment } from './vnpay.service.js';
import {
  amountToVnpay,
  canonicalize,
  MAX_VNPAY_AMOUNT_VND,
  parseVietnamTimestamp,
  signVnpay,
  verifyVnpayQuery,
  vietnamTimestamp,
} from './vnpay.protocol.js';

const settings = {
  tmnCode: 'TESTCODE',
  hashSecret: 'fixture-secret',
  paymentUrl: VNPAY_SANDBOX_URL,
  returnUrl: 'http://localhost/payment/return',
  ipnUrl: '',
};
const fields = {
  vnp_Amount: '1000000',
  vnp_BankCode: 'NCB',
  vnp_OrderInfo: 'HMS DEPOSIT TX123',
  vnp_PayDate: '20261023120000',
  vnp_ResponseCode: '00',
  vnp_TmnCode: 'TESTCODE',
  vnp_TransactionNo: '123456',
  vnp_TransactionStatus: '00',
  vnp_TxnRef: 'TX123',
};
const reference =
  'vnp_Amount=1000000&vnp_BankCode=NCB&vnp_OrderInfo=HMS+DEPOSIT+TX123&vnp_PayDate=20261023120000&vnp_ResponseCode=00&vnp_TmnCode=TESTCODE&vnp_TransactionNo=123456&vnp_TransactionStatus=00&vnp_TxnRef=TX123';
const digest =
  '4114c3d54fbe972d4d0af0f9fb69baca35c8e417c84e6c8cbe4e6475faefe4e9a85fd4d3ce48bbf8bfabb8909d13888346cb497b9fcad2e7dee658cc10d841d5';
const fixture = `${reference}&vnp_SecureHash=${digest}`;
const options = {
  ipAddress: '127.0.0.1',
  createdAt: new Date('2026-10-23T05:00:00Z'),
  expiresAt: new Date('2026-10-23T05:15:00Z'),
};
function expected(): ExpectedVnpayPayment {
  const booking = new Types.ObjectId('000000000000000000000001');
  const invoice = new Types.ObjectId('000000000000000000000002');
  return {
    payment: {
      booking,
      invoice,
      transactionRef: 'TX123',
      method: PaymentMethod.Vnpay,
      purpose: PaymentPurpose.Deposit,
      status: PaymentStatus.Pending,
      amount: 10000,
      isActive: true,
    },
    booking: { id: String(booking), isActive: true },
    invoice: {
      id: String(invoice),
      bookingId: String(booking),
      isActive: true,
    },
  };
}
function callback(changes: Record<string, string | undefined>): string {
  const data: Record<string, string | undefined> = { ...fields, ...changes };
  const query = Object.keys(data)
    .sort()
    .filter((key) => data[key] !== undefined)
    .map(
      (key) => `${key}=${encodeURIComponent(data[key]!).replace(/%20/g, '+')}`,
    )
    .join('&');
  return `${query}&vnp_SecureHash=${createHmac('sha512', settings.hashSecret).update(query).digest('hex')}`;
}
async function moduleFor(config: unknown = settings) {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [
          () => ({
            vnpay: config,
            // NotificationsModule (qua PaymentsModule) cần config này khi khởi tạo.
            notifications: {
              enabled: false,
              user: '',
              appPassword: '',
              fromName: 'Test',
              maxAttempts: 1,
              retryBaseDelayMs: 1,
              sendTimeoutMs: 1000,
              queueCapacity: 100,
              shutdownTimeoutMs: 1000,
            },
          }),
        ],
      }),
      PaymentsModule,
    ],
  })
    .overrideProvider(getModelToken(PaymentTransaction.name))
    .useValue({})
    .overrideProvider(getModelToken(Booking.name))
    .useValue({})
    .overrideProvider(getModelToken(RoomHold.name))
    .useValue({})
    .overrideProvider(getModelToken(Invoice.name))
    .useValue({})
    .compile();
}

describe('VNPay protocol reference vectors', () => {
  it('matches independent .NET HMACSHA512 reference and sorted canonical text', () => {
    expect(canonicalize(fields)).toBe(reference);
    expect(signVnpay(fields, settings.hashSecret)).toBe(digest);
    expect(verifyVnpayQuery(fixture, settings.hashSecret)).toEqual(fields);
  });
  it('uses official Node encoding with plus spaces, literal plus and UTF8', () => {
    expect(
      canonicalize({
        vnp_TxnRef: 'A',
        vnp_OrderInfo: "a + / ? & = % é !'()*~",
      }),
    ).toBe(
      "vnp_OrderInfo=a+%2B+%2F+%3F+%26+%3D+%25+%C3%A9+!'()*~&vnp_TxnRef=A",
    );
    expect(
      verifyVnpayQuery(fixture.replaceAll('+', '%20'), settings.hashSecret),
    ).toEqual(fields);
  });
  it.each([
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER,
    MAX_VNPAY_AMOUNT_VND + 1,
  ])('rejects unsafe amount %s', (amount) => {
    expect(() => amountToVnpay(amount)).toThrow();
  });
  it('supports exact integral VND boundary without truncation', () => {
    expect(amountToVnpay(1)).toBe('100');
    expect(amountToVnpay(MAX_VNPAY_AMOUNT_VND)).toBe('999999999900');
  });
  it('formats Vietnam midnight/year rollover and parses UTC independent of host TZ', () => {
    expect(vietnamTimestamp(new Date('2025-12-31T17:00:00Z'))).toBe(
      '20260101000000',
    );
    expect(parseVietnamTimestamp('20261023120000').toISOString()).toBe(
      '2026-10-23T05:00:00.000Z',
    );
  });
  it.each(['20260230000000', '20261301000000', '20261023240000', 'x'])(
    'rejects invalid date %s',
    (value) => {
      expect(() => parseVietnamTimestamp(value)).toThrow();
    },
  );
  it.each([
    `${fixture}&vnp_Amount=1000000`,
    `${fixture}&%76np_Amount=1000000`,
    `${fixture}&vnp_Amount[]=1000000`,
    `${fixture}&extra=x`,
    `${fixture}&vnp_SecureHash=${digest}`,
    `${fixture}&vnp_PayDate=`,
    `${fixture}&vnp_CardType=%GG`,
    `${fixture}&vnp_CardType=%C0%AF`,
    `${fixture}&vnp_CardType=%00`,
    `${fixture}&`,
    fixture.replace('1000000', '1000100'),
    reference,
    fixture.replace(digest, 'ab'),
    `${fixture}&vnp_SecureHashType=SHA256`,
    '?' + fixture,
    'x'.repeat(8193),
  ])('rejects ambiguous, malformed or tampered query %#', (query) => {
    expect(() => verifyVnpayQuery(query, settings.hashSecret)).toThrow();
  });
});

describe('VNPay Nest module foundation', () => {
  it('exports injectable service; builds signed request without DB writes or customer identity', async () => {
    const module = await moduleFor();
    const service = module.get(VnpayService);
    const url = new URL(service.createPaymentUrl(expected(), options));
    expect(url.origin + url.pathname).toBe(VNPAY_SANDBOX_URL);
    expect(url.searchParams.get('vnp_Amount')).toBe('1000000');
    expect(url.searchParams.get('vnp_CreateDate')).toBe('20261023120000');
    expect(url.searchParams.get('vnp_ExpireDate')).toBe('20261023121500');
    expect(url.searchParams.get('vnp_Version')).toBe('2.1.0');
    expect(url.searchParams.has('vnp_IpnUrl')).toBe(false);
    expect(url.searchParams.has('vnp_BankCode')).toBe(false);
    expect(service.verifyReturn(fixture, expected()).status).toBe(
      PaymentStatus.Success,
    );
    expect(service.prepareIpn(fixture, expected()).action).toBe(
      'compare-and-set',
    );
    expect(expected().payment.status).toBe(PaymentStatus.Pending);
    await module.close();
  });
  it.each(['tmnCode', 'hashSecret', 'paymentUrl', 'returnUrl'])(
    'fails closed with missing %s but boots without credentials',
    async (key) => {
      const module = await moduleFor({ ...settings, [key]: '' });
      expect(() =>
        module.get(VnpayService).createPaymentUrl(expected(), options),
      ).toThrow('not configured');
      expect(() =>
        module.get(VnpayService).verifyReturn(fixture, expected()),
      ).toThrow('not configured');
      await module.close();
    },
  );
  it.each([
    { vnp_TmnCode: 'OTHER123' },
    { vnp_TxnRef: 'TX124' },
    { vnp_OrderInfo: 'HMS FINAL TX123' },
    { vnp_Amount: '1000001' },
    { vnp_Amount: '01000000' },
    { vnp_Amount: '1e6' },
    { vnp_Amount: '1000000000000' },
    { vnp_TransactionNo: '0' },
    { vnp_TransactionNo: '1234567890123456' },
    { vnp_PayDate: undefined },
    { vnp_ResponseCode: undefined },
    { vnp_BankCode: undefined },
    { vnp_TransactionStatus: undefined },
    { vnp_BankTranNo: '!' },
    { vnp_CardType: '1' },
  ])('rejects signed but invalid callback %#', async (changes) => {
    const module = await moduleFor();
    expect(() =>
      module.get(VnpayService).verifyReturn(callback(changes), expected()),
    ).toThrow();
    await module.close();
  });
  it.each([
    ['24', '02', PaymentStatus.Cancelled, 'compare-and-set'],
    ['51', '02', PaymentStatus.Failed, 'compare-and-set'],
    ['00', '02', PaymentStatus.Failed, 'review'],
    ['51', '00', PaymentStatus.Failed, 'review'],
    ['07', '07', PaymentStatus.Failed, 'review'],
    ['99', '01', PaymentStatus.Failed, 'review'],
    ['99', '04', PaymentStatus.Failed, 'review'],
    ['99', '05', PaymentStatus.Failed, 'review'],
  ])(
    'handles outcome %s/%s safely',
    async (response, transaction, status, action) => {
      const module = await moduleFor();
      const plan = module.get(VnpayService).prepareIpn(
        callback({
          vnp_ResponseCode: response,
          vnp_TransactionStatus: transaction,
        }),
        expected(),
      );
      expect(plan.result.status).toBe(status);
      expect(plan.action).toBe(action);
      await module.close();
    },
  );
  it('recognizes persisted duplicate and rejects conflicting terminal callback', async () => {
    const module = await moduleFor();
    const service = module.get(VnpayService);
    const record = expected();
    record.payment = {
      ...record.payment,
      status: PaymentStatus.Success,
      providerTransactionRef: '123456',
      paidAt: options.createdAt,
    };
    expect(service.prepareIpn(fixture, record).action).toBe('duplicate');
    expect(() =>
      service.prepareIpn(
        callback({ vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }),
        record,
      ),
    ).toThrow('conflict');
    expect(() =>
      service.prepareIpn(callback({ vnp_TransactionNo: '123457' }), record),
    ).toThrow('conflict');
    expect(() =>
      service.prepareIpn(callback({ vnp_PayDate: '20261023120100' }), record),
    ).toThrow('conflict');
    expect(() => service.createPaymentUrl(record, options)).toThrow('conflict');
    await module.close();
  });
  it.each(['booking', 'invoice', 'purpose', 'method', 'inactive'])(
    'rejects persisted relationship mismatch %s',
    async (kind) => {
      const module = await moduleFor();
      const record = expected();
      if (kind === 'booking')
        record.invoice.bookingId = '000000000000000000000003';
      if (kind === 'invoice') record.invoice.id = '000000000000000000000003';
      if (kind === 'purpose')
        record.payment = {
          ...record.payment,
          purpose: 'OTHER' as PaymentPurpose,
        };
      if (kind === 'method')
        record.payment = { ...record.payment, method: PaymentMethod.Cash };
      if (kind === 'inactive') record.booking.isActive = false;
      expect(() =>
        module.get(VnpayService).verifyReturn(fixture, record),
      ).toThrow('relationship');
      await module.close();
    },
  );
  it.each([
    { ipAddress: 'bad' },
    { locale: 'fr' },
    { bankCode: '?' },
    { expiresAt: options.createdAt },
  ])('rejects invalid request options %#', async (change) => {
    const module = await moduleFor();
    expect(() =>
      module.get(VnpayService).createPaymentUrl(expected(), {
        ...options,
        ...change,
      } as typeof options),
    ).toThrow();
    await module.close();
  });
});

describe('VNPay environment validation', () => {
  const base = { MONGODB_URI: 'mongodb://localhost/test' };
  it('keeps unconfigured gateway optional', () => {
    expect(envValidationSchema.validate(base).error).toBeUndefined();
  });
  it.each([
    ['VNPAY_TMN_CODE', 'bad'],
    ['VNPAY_HASH_SECRET', 'has space'],
    ['VNPAY_PAYMENT_URL', 'https://example.com/pay'],
    ['VNPAY_RETURN_URL', 'http://example.com/return'],
    ['VNPAY_RETURN_URL', 'https://example.com/return?x=1'],
    ['VNPAY_RETURN_URL', 'https://user:pass@example.com/return'],
    ['VNPAY_RETURN_URL', 'https://example.com/#hash'],
    ['VNPAY_IPN_URL', 'http://localhost/ipn'],
  ])(
    'rejects invalid %s %# without exposing secret in service errors',
    (key, value) => {
      expect(
        envValidationSchema.validate({ ...base, [key]: value }).error,
      ).toBeDefined();
    },
  );
});
