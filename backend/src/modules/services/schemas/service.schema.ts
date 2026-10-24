import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { isMoneyVnd } from '../../../common/database/conventions.js';

const moneySchema = {
  bsonType: ['double', 'int', 'long'],
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
  multipleOf: 1,
};
/** Server-side guard also covers query updates, pipelines and bulk writes. */
export const SERVICE_COLLECTION_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'billable', 'isActive'],
    properties: {
      name: { bsonType: 'string', minLength: 1, pattern: '\\S' },
      description: { bsonType: 'string' },
      unit: { bsonType: 'string' },
      billable: { bsonType: 'bool' },
      isActive: { bsonType: 'bool' },
      price: { anyOf: [{ bsonType: 'null' }, moneySchema] },
    },
    anyOf: [
      { properties: { billable: { enum: [false] } } },
      { properties: { isActive: { enum: [false] } } },
      { required: ['price'], properties: { price: moneySchema } },
    ],
  },
};
function strictBoolean(value: unknown) {
  if (value !== undefined && typeof value !== 'boolean')
    throw new Error('Expected a boolean');
  return value;
}
function strictString(value: unknown) {
  if (value !== undefined && typeof value !== 'string')
    throw new Error('Expected a string');
  return value;
}

@Schema({
  timestamps: true,
  collection: 'services',
  collectionOptions: {
    validator: SERVICE_COLLECTION_VALIDATOR,
    validationLevel: 'strict',
    validationAction: 'error',
  },
})
export class Service {
  @Prop({ required: true, unique: true, trim: true, set: strictString })
  name: string;

  @Prop({ default: '', trim: true, set: strictString })
  description: string;

  @Prop({ default: '', trim: true, set: strictString })
  unit: string;

  @Prop({ required: true, default: true, set: strictBoolean })
  billable: boolean;

  @Prop({
    type: Number,
    default: null,
    set: (value: unknown) => {
      if (value != null && typeof value !== 'number')
        throw new Error('price must be an integer VND amount');
      return value;
    },
    required: function (this: Service) {
      return this.billable && this.isActive;
    },
    validate: {
      validator: (value: number | null) => value == null || isMoneyVnd(value),
      message: 'price must be a safe non-negative integer VND amount',
    },
  })
  price: number | null;

  @Prop({ required: true, default: true, set: strictBoolean })
  isActive: boolean;
}
export const ServiceSchema = SchemaFactory.createForClass(Service);
