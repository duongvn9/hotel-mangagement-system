import Joi from 'joi';

export const VNPAY_SANDBOX_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

const callbackUrl = Joi.string().max(255).uri({ scheme: ['https', 'http'] }).custom((value: string, helpers) => {
  const url = new URL(value);
  if (url.username || url.password || url.hash || url.search ||
      (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    return helpers.error('any.invalid');
  }
  return value;
});

export const vnpayConfigFields = {
  tmnCode: Joi.string().pattern(/^[a-zA-Z0-9]{8}$/),
  hashSecret: Joi.string().pattern(/^\S+$/),
  paymentUrl: Joi.string().valid(VNPAY_SANDBOX_URL),
  returnUrl: callbackUrl,
  ipnUrl: callbackUrl.custom((value: string, helpers) =>
    new URL(value).protocol === 'https:' ? value : helpers.error('any.invalid')),
};

export const vnpayConfigSchema = Joi.object({
  tmnCode: vnpayConfigFields.tmnCode.required(),
  hashSecret: vnpayConfigFields.hashSecret.required(),
  paymentUrl: vnpayConfigFields.paymentUrl.required(),
  returnUrl: vnpayConfigFields.returnUrl.required(),
  ipnUrl: vnpayConfigFields.ipnUrl.allow('').optional(),
});
