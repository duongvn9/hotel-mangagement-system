import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true, collection: 'amenities' })
export class Amenity {
  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop()
  iconUrl?: string;

  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const AmenitySchema = SchemaFactory.createForClass(Amenity);
