import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Equipment } from './schemas/equipment.schema.js';
import { EquipmentCondition } from '../../common/constants/equipment-condition.enum.js';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectModel(Equipment.name) private readonly equipment: Model<Equipment>,
  ) {}
  findActive(id: string) {
    return this.equipment.findOne({ _id: id, isActive: true }).lean().exec();
  }
  async markFaulty(id: string): Promise<void> {
    await this.equipment.updateOne(
      { _id: id, isActive: true, condition: EquipmentCondition.Good },
      { $set: { condition: EquipmentCondition.Faulty } },
      { runValidators: true },
    );
  }
  async targets(search: string) {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.equipment
      .aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'rooms',
            localField: 'room',
            foreignField: '_id',
            as: 'roomData',
          },
        },
        {
          $match: {
            $or: [
              'assetCode',
              'name',
              'category',
              'location',
              'roomData.roomNumber',
            ].map((field) => ({ [field]: { $regex: literal, $options: 'i' } })),
          },
        },
        { $sort: { assetCode: 1, _id: 1 } },
        { $limit: 20 },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            assetCode: 1,
            name: 1,
            category: 1,
            location: 1,
            roomId: { $ifNull: [{ $toString: '$room' }, null] },
            roomNumber: {
              $ifNull: [{ $arrayElemAt: ['$roomData.roomNumber', 0] }, null],
            },
          },
        },
      ])
      .exec();
  }
}
