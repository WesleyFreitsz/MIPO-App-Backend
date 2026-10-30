import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { GamePlaysService } from './game-plays.service';
import { CreateGamePlayDto } from './dto/game-play.dto';

@UseGuards(JwtAuthGuard)
@Controller('game-plays')
export class GamePlaysController {
  constructor(private readonly gamePlaysService: GamePlaysService) {}

  @Get('mine')
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.gamePlaysService.listForUser(
      user.userId,
      user.userId,
      query.skip,
      query.take,
    );
  }

  @Get('recommendations')
  recommendations(@CurrentUser() user: AuthenticatedUser) {
    return this.gamePlaysService.recommendationsFor(user.userId);
  }

  @Get('users/:id')
  findForUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) targetId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.gamePlaysService.listForUser(
      user.userId,
      targetId,
      query.skip,
      query.take,
    );
  }

  @Post('games/:gameId')
  record(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Body() dto: CreateGamePlayDto,
  ) {
    return this.gamePlaysService.recordManual(user.userId, gameId, dto);
  }
}
