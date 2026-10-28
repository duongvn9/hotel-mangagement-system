import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type Types } from 'mongoose';

/** MAINTENANCE source matches TasksService's explicit `maintenances` collection map. */
@Schema({ timestamps: true, collection: 'maintenances' })
export class Maintenance {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true,
  })
  reportedBy: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', immutable: true })
  room?: Types.ObjectId;
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Equipment',
    immutable: true,
  })
  equipment?: Types.ObjectId;
  @Prop({ trim: true, maxlength: 200, immutable: true })
  facilityLocation?: string;
  @Prop({
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 2000,
    immutable: true,
  })
  description: string;
  @Prop({ required: true, default: true, immutable: true })
  requiresAction: boolean;
  @Prop({ required: true, default: false, immutable: true })
  preventsSafeUse: boolean;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Task' })
  task?: Types.ObjectId;

  // Delivery bookkeeping, not task completion status. Stable identity survives partial failures/restarts.
  @Prop({ required: true, immutable: true }) requestKey: string;
  @Prop({ required: true, immutable: true }) requestFingerprint: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, immutable: true })
  taskIdentity?: Types.ObjectId;
  @Prop({
    type: { roomMarkedUnavailable: Boolean, warnings: [String] },
    default: undefined,
  })
  receipt?: { roomMarkedUnavailable: boolean; warnings: string[] };
}
export const MaintenanceSchema = SchemaFactory.createForClass(Maintenance);
MaintenanceSchema.index(
  { reportedBy: 1, requestKey: 1 },
  { unique: true, name: 'unique_maintenance_request' },
);
MaintenanceSchema.index({ room: 1, createdAt: -1 });
MaintenanceSchema.index({ equipment: 1, createdAt: -1 });
MaintenanceSchema.index({ reportedBy: 1, createdAt: -1 });
MaintenanceSchema.index({ task: 1 });
