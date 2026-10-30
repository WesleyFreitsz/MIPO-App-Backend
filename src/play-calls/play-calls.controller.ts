import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { PlayCallsService } from './play-calls.service';
import { CreatePlayCallDto, PlayCallsQueryDto } from './dto/play-call.dto';

@Controller('play-calls')
@UseGuards(JwtAuthGuard)
export class PlayCallsController {
  constructor(private playCallsService: PlayCallsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PlayCallsQueryDto,
  ) {
    return this.playCallsService.list(user.userId, query.mode);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.playCallsService.findOne(user.userId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePlayCallDto,
  ) {
    return this.playCallsService.create(user.userId, dto);
  }

  @Post(':id/join')
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.playCallsService.join(user.userId, id);
  }

  @Post(':id/leave')
  leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.playCallsService.leave(user.userId, id);
  }

  @Patch(':id/close')
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.playCallsService.close(user.userId, id);
  }
}
