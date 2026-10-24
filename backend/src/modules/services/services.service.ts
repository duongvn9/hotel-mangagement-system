import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type PipelineStage } from 'mongoose';
import { Service } from './schemas/service.schema.js';
import { ListServicesQuery } from './dto/list-services.dto.js';
import type {
  ServiceListResponse,
  ServiceResponse,
} from './dto/service-response.dto.js';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private readonly services: Model<Service>,
  ) {}

  async list(query: ListServicesQuery): Promise<ServiceListResponse> {
    const skip = (query.page - 1) * query.limit;
    if (!Number.isSafeInteger(skip))
      throw new BadRequestException(
        'page exceeds the supported pagination range',
      );
    const filter = {
      ...(query.search
        ? {
            name: {
              $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
      ...(query.billable === undefined ? {} : { billable: query.billable }),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const direction = query.sortOrder === 'desc' ? -1 : 1;
    const items: PipelineStage.FacetPipelineStage[] = [
      ...(query.sortBy === 'price'
        ? [
            {
              $addFields: {
                _missingPrice: {
                  $cond: [{ $eq: [{ $ifNull: ['$price', null] }, null] }, 1, 0],
                },
              },
            },
          ]
        : []),
      {
        $sort: {
          ...(query.sortBy === 'price' ? { _missingPrice: 1 as const } : {}),
          [query.sortBy]: direction,
          _id: 1,
        },
      },
      { $skip: skip },
      { $limit: query.limit },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          name: 1,
          description: { $ifNull: ['$description', ''] },
          unit: { $ifNull: ['$unit', ''] },
          billable: 1,
          price: { $ifNull: ['$price', null] },
          isActive: 1,
        },
      },
    ];
    const [result] = await this.services
      .aggregate<{ items: ServiceResponse[]; count: { total: number }[] }>([
        { $match: filter },
        { $facet: { items, count: [{ $count: 'total' }] } },
      ])
      .exec();
    return {
      items: result?.items ?? [],
      total: result?.count[0]?.total ?? 0,
      page: query.page,
      limit: query.limit,
    };
  }
}
