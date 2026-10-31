import { Controller, Get } from '@nestjs/common';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AssetImagesService,
  type AssetImageFile,
} from '../../common/asset-images.service.js';
import {
  ApiProperty,
  ApiTags,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { Role } from '../../common/constants/role.enum.js';
import { AmenitiesService } from './amenities.service.js';
import { Body, Param, Patch, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { CreateAmenityDto, UpdateAmenityDto } from './dto/write-amenity.dto.js';
import { AmenityResponse } from './dto/amenity-response.dto.js';
import { Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOperation } from '@nestjs/swagger';
import { ListAmenitiesQuery } from './dto/list-amenities.dto.js';
import { AmenityListResponse } from './dto/amenity-response.dto.js';

export class AmenityOptionDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

@ApiTags('amenities')
@Controller('amenities')
@Roles(Role.Manager)
@Permissions('facility:manage')
export class AmenitiesController {
  constructor(
    private readonly amenities: AmenitiesService,
    private readonly images: AssetImagesService,
  ) {}

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  @ApiOperation({ summary: 'Upload amenity image to local archive and S3' })
  uploadImage(@UploadedFile() file?: AssetImageFile) {
    return this.images.upload(file, 'amenities');
  }

  @Get('options')
  @ApiOkResponse({ type: [AmenityOptionDto] })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  options() {
    return this.amenities.options();
  }

  @Post()
  @ApiOperation({
    summary:
      'UC52 — Create amenity and RoomType assignments; compensates failed assignment writes',
  })
  @ApiCreatedResponse({ type: AmenityResponse })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiServiceUnavailableResponse({
    description:
      'Assignment creation failed; compensation status is described in the error',
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  create(@Body() dto: CreateAmenityDto) {
    return this.amenities.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'UC52 — Amenity details including current RoomType assignments',
  })
  @ApiOkResponse({ type: AmenityResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  detail(@Param('id') id: string) {
    return this.amenities.detail(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'UC52 — Partial update; roomTypeIds is the target assignment set, omission preserves assignments',
  })
  @ApiOkResponse({ type: AmenityResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiServiceUnavailableResponse({
    description:
      'Partial assignment write may require replaying the same request',
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  update(@Param('id') id: string, @Body() dto: UpdateAmenityDto) {
    return this.amenities.update(id, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'UC51 — View amenity list and reverse RoomType assignments (read only)',
  })
  @ApiOkResponse({ type: AmenityListResponse })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(@Query() query: ListAmenitiesQuery) {
    return this.amenities.list(query);
  }
}
