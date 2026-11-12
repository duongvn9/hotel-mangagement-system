import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** A single atomic reservation per authenticated account or anonymous guest session. */
@Schema({ collection: 'holdprincipallocks' })
export class HoldPrincipalLock {
  @Prop({ required: true })
  _id: string;

  @Prop({ type: Types.ObjectId })
  booking?: Types.ObjectId;

  @Prop({ required: true })
  expiresAt: Date;
}

export const HoldPrincipalLockSchema =
  SchemaFactory.createForClass(HoldPrincipalLock);
