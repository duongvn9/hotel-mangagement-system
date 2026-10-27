import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  ListFeedbackQuery,
  MyStaysResponse,
  ReplyFeedbackDto,
  SubmitFeedbackDto,
  SubmittedFeedback,
} from './dto/feedback.dto.js';
import { FeedbackService } from './feedback.service.js';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** UC39 Submit Feedback: khách gửi phản hồi cho lần lưu trú đã trả phòng của mình. */
  @Roles(Role.Customer)
  @Post()
  @ApiOperation({
    summary: 'UC39 — Submit feedback for a completed stay (Customer)',
  })
  @ApiCreatedResponse({ type: SubmittedFeedback })
  @ApiConflictResponse({
    description: 'Stay is not checked out, or feedback was already sent',
  })
  submit(@Body() dto: SubmitFeedbackDto, @CurrentUser() user: AuthUser) {
    return this.feedback.submit(dto, user);
  }

  /** Khai báo trước `:id` để 'mine' không bị hiểu là id. */
  @Roles(Role.Customer)
  @Get('mine')
  @ApiOperation({
    summary:
      'UC39 — My completed stays with the feedback sent and the reply (Customer)',
  })
  @ApiOkResponse({ type: MyStaysResponse })
  mine(@CurrentUser() user: AuthUser) {
    return this.feedback.mine(user);
  }

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
