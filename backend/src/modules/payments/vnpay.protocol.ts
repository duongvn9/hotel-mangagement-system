import { createHmac, timingSafeEqual } from 'node:crypto';

export const MAX_VNPAY_AMOUNT_VND = 9_999_999_999;

export class VnpayValidationError extends Error {
  constructor(readonly reason: 'query' | 'signature' | 'fields' | 'amount' | 'relationship' | 'conflict') {
    super(`Invalid VNPay ${reason}`);
  }
}

export function amountToVnpay(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_VNPAY_AMOUNT_VND) {
    throw new VnpayValidationError('amount');
  }
  return String(amount * 100);
}

export function vietnamTimestamp(date: Date): string {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new VnpayValidationError('fields');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  const result = ['year', 'month', 'day', 'hour', 'minute', 'second'].map(get).join('');
  if (!/^\d{14}$/.test(result)) throw new VnpayValidationError('fields');
  return result;
}

export function parseVietnamTimestamp(value: string): Date {
  if (!/^\d{14}$/.test(value)) throw new VnpayValidationError('fields');
  const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+07:00`);
  if (vietnamTimestamp(date) !== value) throw new VnpayValidationError('fields');
  return date;
}

const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, '+');

export function canonicalize(params: Readonly<Record<string, string>>): string {
  return Object.keys(params).sort().map((key) => {
    if (!/^vnp_[A-Za-z]+$/.test(key) || typeof params[key] !== 'string' || !params[key]) {
      throw new VnpayValidationError('fields');
    }
    return `${encode(key)}=${encode(params[key])}`;
  }).join('&');
}

export function signVnpay(params: Readonly<Record<string, string>>, secret: string): string {
  if (!secret || !/^\S+$/.test(secret)) throw new VnpayValidationError('fields');
  return createHmac('sha512', secret).update(canonicalize(params), 'utf8').digest('hex');
}

const callbackFields = new Set([
  'vnp_TmnCode', 'vnp_Amount', 'vnp_BankCode', 'vnp_BankTranNo', 'vnp_CardType',
  'vnp_PayDate', 'vnp_OrderInfo', 'vnp_TransactionNo', 'vnp_ResponseCode',
  'vnp_TransactionStatus', 'vnp_TxnRef', 'vnp_SecureHash', 'vnp_SecureHashType',
]);

export function verifyVnpayQuery(raw: string, secret: string): Readonly<Record<string, string>> {
  if (typeof raw !== 'string' || !raw || raw.length > 8192) throw new VnpayValidationError('query');
  const params: Record<string, string> = Object.create(null);
  for (const pair of raw.split('&')) {
    const pieces = pair.split('=');
    if (pieces.length !== 2) throw new VnpayValidationError('query');
    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(pieces[0].replace(/\+/g, ' '));
      value = decodeURIComponent(pieces[1].replace(/\+/g, ' '));
    } catch {
      throw new VnpayValidationError('query');
    }
    if (!callbackFields.has(key) || Object.hasOwn(params, key) || !value || [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
      throw new VnpayValidationError('query');
    }
    params[key] = value;
  }
  const hash = params.vnp_SecureHash;
  if (!hash || !/^[a-f\d]{128}$/i.test(hash)) throw new VnpayValidationError('signature');
  if (params.vnp_SecureHashType !== undefined && params.vnp_SecureHashType !== 'HMACSHA512') {
    throw new VnpayValidationError('signature');
  }
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;
  if (!timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(signVnpay(params, secret), 'hex'))) {
    throw new VnpayValidationError('signature');
  }
  return Object.freeze(params);
}
