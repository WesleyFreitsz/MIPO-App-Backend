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
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { UserRole } from 'src/users/entities/user.entity';
import { MonthlyPeriodQueryDto } from 'src/monthly-games/dto/monthly-game.dto';
import { ReviewsService } from './reviews.service';
import { CreateOrderReviewDto, CreateVisitReviewDto } from './dto/review.dto';

@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get('pending')
  getPending(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewsService.getPending(user.userId);
  }

  @Post('visits/:visitId')
  reviewVisit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('visitId', ParseUUIDPipe) visitId: string,
    @Body() dto: CreateVisitReviewDto,
  ) {
    return this.reviewsService.reviewVisit(user.userId, visitId, dto);
  }

  @Post('orders/:orderId')
  reviewOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateOrderReviewDto,
  ) {
    return this.reviewsService.reviewOrder(user.userId, orderId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Get('stats')
  getStats(@Query() query: MonthlyPeriodQueryDto) {
    return this.reviewsService.getStats(query.year, query.month);
  }

  @Roles(UserRole.ADMIN)
  @Get('stats/export')
  async exportStats(@Query() query: MonthlyPeriodQueryDto) {
    return {
      csv: await this.reviewsService.exportCsv(query.year, query.month),
    };
  }
}
