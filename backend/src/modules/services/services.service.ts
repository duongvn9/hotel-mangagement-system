import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { isMoneyVnd } from '../../common/database/conventions.js';
import { Model, type PipelineStage } from 'mongoose';
import { Service } from './schemas/service.schema.js';
import { ListServicesQuery } from './dto/list-services.dto.js';
import { CreateServiceDto, UpdateServiceDto } from './dto/write-service.dto.js';
import type {
  ServiceListResponse,
  ServiceResponse,
} from './dto/service-response.dto.js';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private readonly services: Model<Service>,
  ) {}

  private validId(id: string) {
    return /^[0-9a-f]{24}$/i.test(id);
  }
  private validateId(id: string) {
    if (!this.validId(id))
      throw new BadRequestException('Service id không hợp lệ');
  }
  private response(row: Service & { _id: Types.ObjectId }): ServiceResponse {
    return {
      id: String(row._id),
      name: row.name,
      imageUrl: row.imageUrl,
      description: row.description ?? '',
      unit: row.unit ?? '',
      billable: row.billable,
      price: row.price ?? null,
      isActive: row.isActive,
    };
  }
  private validateState(
    state: Pick<Service, 'price' | 'billable' | 'isActive'>,
  ) {
    if (state.price != null && !isMoneyVnd(state.price))
      throw new BadRequestException(
        'price: giá phải là số nguyên VND không âm trong giới hạn an toàn',
      );
    if (state.billable && state.isActive && state.price == null)
      throw new BadRequestException(
        'price: cần giá hợp lệ để kích hoạt dịch vụ tính phí',
      );
  }
  private async uniqueName(name: string, except?: string) {
    if (
      await this.services.exists({
        name,
        ...(except ? { _id: { $ne: except } } : {}),
      })
    )
      throw new ConflictException('Tên dịch vụ đã tồn tại');
  }
  private writeError(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 11000)
        throw new ConflictException('Tên dịch vụ đã tồn tại');
      if (error.code === 121)
        throw new BadRequestException(
          'price: cần giá hợp lệ để kích hoạt dịch vụ tính phí',
        );
    }
    throw error;
  }
  async detail(id: string): Promise<ServiceResponse> {
    this.validateId(id);
    const row = await this.services.findById(id).lean().exec();
    if (!row) throw new NotFoundException('Không tìm thấy dịch vụ');
    return this.response(row);
  }
  /** H4 read contract: inactive, missing and malformed IDs all return null. */
  async findActiveById(id: string): Promise<ServiceResponse | null> {
    if (!this.validId(id)) return null;
    const row = await this.services
      .findOne({ _id: id, isActive: true })
      .lean()
      .exec();
    return row ? this.response(row) : null;
  }
  async create(dto: CreateServiceDto): Promise<ServiceResponse> {
    const input = {
      ...dto,
      description: dto.description ?? '',
      unit: dto.unit ?? '',
      billable: dto.billable ?? true,
      price: dto.price ?? null,
      isActive: dto.isActive ?? true,
    };
    this.validateState(input);
    await this.uniqueName(input.name);
    try {
      return this.response(await this.services.create(input));
    } catch (error) {
      this.writeError(error);
    }
  }
  async update(id: string, dto: UpdateServiceDto): Promise<ServiceResponse> {
    this.validateId(id);
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateServiceDto;
    if (!Object.keys(changes).length)
      throw new BadRequestException('Cần ít nhất một trường cập nhật');
    const current = await this.services.findById(id).lean().exec();
    if (!current) throw new NotFoundException('Không tìm thấy dịch vụ');
    this.validateState({ ...current, ...changes });
    if (changes.name !== undefined) await this.uniqueName(changes.name, id);
    const version = (current as typeof current & { __v?: number }).__v;
    try {
      // Compare-and-swap the validated snapshot; every UC54 write increments the version.
      const updated = await this.services
        .findOneAndUpdate(
          {
            _id: id,
            __v: version === undefined ? { $exists: false } : version,
          },
          { $set: changes, $inc: { __v: 1 } },
          { returnDocument: 'after', runValidators: true },
        )
        .lean()
        .exec();
      if (!updated)
        throw new ConflictException('Dữ liệu đã thay đổi, hãy tải lại');
      return this.response(updated);
    } catch (error) {
      this.writeError(error);
    }
  }

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
          imageUrl: 1,
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

  /**
   * Danh mục dịch vụ công khai cho luồng đặt phòng (khách chưa đăng nhập vẫn xem được).
   * Chỉ dịch vụ đang hoạt động; giá hiển thị để khách chọn kèm khi đặt.
   */
  async publicCatalog() {
    const rows = await this.services
      .find({ isActive: true })
      .select('name unit billable price imageUrl')
      .sort({ name: 1 })
      .lean();
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        name: row.name,
        imageUrl: row.imageUrl,
        unit: row.unit ?? '',
        billable: row.billable,
        unitPriceVND: row.billable === false ? 0 : (row.price ?? null),
      })),
    };
  }
}
