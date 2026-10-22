import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ListFeedbackQuery, ReplyFeedbackDto } from './dto/feedback.dto.js';
import { FeedbackService } from './feedback.service.js';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** UC40 View Feedback List (BR-FB-04). */
  @Roles(Role.Receptionist, Role.Manager)
  @Get()
  list(@Query() query: ListFeedbackQuery) {
    return this.feedback.list(query);
  }

  @Roles(Role.Receptionist, Role.Manager)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.feedback.findOne(id);
  }

  /** UC41 Reply to Feedback: chỉ Lễ tân (BR-FB-05). */
  @Roles(Role.Receptionist)
  @Post(':id/reply')
  reply(
    @Param('id') id: string,
    @Body() dto: ReplyFeedbackDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.feedback.reply(id, dto.content, user.id);
  }
}
