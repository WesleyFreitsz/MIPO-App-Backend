import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { UserRole } from 'src/users/entities/user.entity';
import { MonthlyGamesService } from './monthly-games.service';
import {
  CreateMonthlyGameDto,
  ManualMonthlyGameScoreDto,
  MonthlyPeriodQueryDto,
  RejectMonthlyGameScoreDto,
  SubmitMonthlyGameScoreDto,
  UpdateMonthlyGameDto,
} from './dto/monthly-game.dto';

@Controller('monthly-games')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MonthlyGamesController {
  constructor(private monthlyGamesService: MonthlyGamesService) {}

  @Get()
  getPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MonthlyPeriodQueryDto,
  ) {
    return this.monthlyGamesService.getPeriod(user.userId, query);
  }

  @Get('history')
  getHistory(@Query() query: PaginationQueryDto) {
    return this.monthlyGamesService.getHistory(query.skip, query.take);
  }

  @Get('scores/mine')
  getMyScores(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.monthlyGamesService.getMyScores(
      user.userId,
      query.skip,
      query.take,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @Get('scores/pending')
  getPendingScores(@Query() query: PaginationQueryDto) {
    return this.monthlyGamesService.getPendingScores(query.skip, query.take);
  }

  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @Patch('scores/:scoreId/approve')
  approveScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scoreId', ParseUUIDPipe) scoreId: string,
  ) {
    return this.monthlyGamesService.approveScore(scoreId, user.userId);
  }

  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @Patch('scores/:scoreId/reject')
  rejectScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scoreId', ParseUUIDPipe) scoreId: string,
    @Body() dto: RejectMonthlyGameScoreDto,
  ) {
    return this.monthlyGamesService.rejectScore(
      scoreId,
      user.userId,
      dto.reason,
    );
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateMonthlyGameDto) {
    return this.monthlyGamesService.create(dto);
  }

  @Get(':id/ranking')
  getRanking(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.monthlyGamesService.getRanking(id, query.skip, query.take);
  }

  @Post(':id/scores')
  submitScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitMonthlyGameScoreDto,
  ) {
    return this.monthlyGamesService.submitScore(user.userId, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/scores/manual')
  registerManualScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ManualMonthlyGameScoreDto,
  ) {
    return this.monthlyGamesService.registerManualScore(user.userId, id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMonthlyGameDto,
  ) {
    return this.monthlyGamesService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.monthlyGamesService.remove(id);
  }
}
