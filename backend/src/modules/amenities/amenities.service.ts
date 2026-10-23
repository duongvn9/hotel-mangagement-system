import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Amenity } from './schemas/amenity.schema.js';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectModel(Amenity.name) private readonly amenities: Model<Amenity>,
  ) {}

  async options() {
    const rows = await this.amenities
      .find({ isActive: true })
      .sort({ name: 1, _id: 1 })
      .lean()
      .exec();
    return rows.map((row) => ({ id: String(row._id), name: row.name }));
  }

  async validateNew(ids: string[], retained: string[] = []) {
    const added = ids.filter((id) => !retained.includes(id));
    if (!added.length) return;
    const rows = await this.amenities
      .find({ _id: { $in: added }, isActive: true })
      .select('_id')
      .lean()
      .exec();
    const found = new Set(rows.map((row) => String(row._id)));
    const invalid = added.filter((id) => !found.has(id));
    if (invalid.length)
      throw new BadRequestException(
        `amenities không hợp lệ: ${invalid.join(', ')}`,
      );
  }
}
