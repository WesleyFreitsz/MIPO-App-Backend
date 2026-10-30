import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Query,
  ParseEnumPipe,
} from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { UserRole } from 'src/users/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateRewardDto, UpdateRewardDto } from './dto/reward.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { RedemptionStatus } from './entities/reward-redemption.entity';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  async findAll() {
    return this.rewardsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('redemptions/me')
  async myRedemptions(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.findMyRedemptions(user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('redemptions')
  async redemptions(
    @Query('status', new ParseEnumPipe(RedemptionStatus, { optional: true }))
    status?: RedemptionStatus,
  ) {
    return this.rewardsService.findRedemptions(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('redemptions/:id/deliver')
  async deliver(@Param('id', ParseUUIDPipe) id: string) {
    return this.rewardsService.markDelivered(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/redeem')
  async redeem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rewardsService.redeem(user.userId, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() dto: CreateRewardDto) {
    return this.rewardsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRewardDto,
  ) {
    return this.rewardsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rewardsService.remove(id);
  }
}
