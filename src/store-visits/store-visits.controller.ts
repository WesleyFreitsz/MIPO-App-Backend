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
import { StoreVisitsService } from './store-visits.service';
import {
  StaffCheckInDto,
  StaffUsersQueryDto,
  StoreCheckInDto,
} from './dto/store.dto';

@Controller('store')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoreVisitsController {
  constructor(private storeVisitsService: StoreVisitsService) {}

  @Post('check-in')
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StoreCheckInDto,
  ) {
    return this.storeVisitsService.checkIn(user.userId, dto.code);
  }

  @Post('check-out')
  checkOut(@CurrentUser() user: AuthenticatedUser) {
    return this.storeVisitsService.checkOutUser(user.userId);
  }

  @Get('present')
  getPresent(@CurrentUser() user: AuthenticatedUser) {
    return this.storeVisitsService.getPresent(user.userId);
  }

  @Roles(UserRole.ADMIN, UserRole.WAITER)
  @Get('staff/users')
  searchUsers(@Query() query: StaffUsersQueryDto) {
    return this.storeVisitsService.searchUsersForStaff(query.search);
  }

  @Roles(UserRole.ADMIN, UserRole.WAITER)
  @Post('staff-check-in')
  staffCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StaffCheckInDto,
  ) {
    return this.storeVisitsService.staffCheckIn(user.userId, dto.userId);
  }

  @Roles(UserRole.ADMIN, UserRole.WAITER)
  @Post('staff-check-out/:userId')
  staffCheckOut(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.storeVisitsService.checkOutUser(userId);
  }

  @Roles(UserRole.ADMIN)
  @Get('code')
  getCode() {
    return this.storeVisitsService.getCode();
  }

  @Roles(UserRole.ADMIN)
  @Post('code/rotate')
  rotateCode() {
    return this.storeVisitsService.rotateCode();
  }

  @Roles(UserRole.ADMIN)
  @Get('stats')
  getStats(@Query() query: MonthlyPeriodQueryDto) {
    return this.storeVisitsService.getStats(query.year, query.month);
  }

  @Roles(UserRole.ADMIN)
  @Get('stats/export')
  async exportStats(@Query() query: MonthlyPeriodQueryDto) {
    return {
      csv: await this.storeVisitsService.exportStatsCsv(
        query.year,
        query.month,
      ),
    };
  }
}
