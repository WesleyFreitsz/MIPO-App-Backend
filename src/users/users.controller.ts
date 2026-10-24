import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from 'src/auth/dto/update-profile.dto';
import { UserRole } from './entities/user.entity';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { AdjustCoinsDto } from './dto/adjust-coins.dto';
import { SetBannedDto } from './dto/set-banned.dto';
import { UpdateNotificationTokenDto } from './dto/update-notification-token.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(user.userId);
  }

  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  async adminList(@Query() pagination: PaginationQueryDto) {
    return this.usersService.findAllForAdmin(pagination.skip, pagination.take);
  }

  @Patch('notification-token')
  async updateToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationTokenDto,
  ) {
    return this.usersService.updateNotificationToken(
      user.userId,
      dto.token || null,
    );
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Patch(':id/coins')
  @Roles(UserRole.ADMIN)
  async adminAddCoins(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustCoinsDto,
  ) {
    return this.usersService.addCoins(id, dto.amount ?? 1);
  }

  @Patch(':id/ban')
  @Roles(UserRole.ADMIN)
  async adminBan(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBannedDto,
  ) {
    return this.usersService.setBanned(admin.userId, id, dto.banned ?? true);
  }

  @Get(':id')
  getUserById(@Param('id', ParseUUIDPipe) userId: string) {
    return this.usersService.findOne(userId);
  }
}
