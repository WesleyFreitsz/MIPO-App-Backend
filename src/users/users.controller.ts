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
import { AdminUsersQueryDto, SetRoleDto } from './dto/admin-users.dto';
import { AdjustCoinsDto } from './dto/adjust-coins.dto';
import { SetBannedDto } from './dto/set-banned.dto';
import { UpdateNotificationTokenDto } from './dto/update-notification-token.dto';
import { AcceptTermsDto, SetBirthDateDto } from './dto/legal-consent.dto';
import { AccountDataService } from './account-data.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountDataService: AccountDataService,
  ) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOwnProfile(user.userId);
  }

  @Get('me/export')
  exportMyData(@CurrentUser() user: AuthenticatedUser) {
    return this.accountDataService.exportUserData(user.userId);
  }

  @Patch('me/birth-date')
  setBirthDate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetBirthDateDto,
  ) {
    return this.usersService.setBirthDate(user.userId, dto.birthDate);
  }

  @Patch('me/accept-terms')
  acceptTerms(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptTermsDto,
  ) {
    return this.usersService.acceptTerms(user.userId, dto.version);
  }

  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  async adminList(@Query() query: AdminUsersQueryDto) {
    return this.usersService.findAllForAdmin(
      query.skip,
      query.take,
      query.search,
    );
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

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  async adminSetRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRoleDto,
  ) {
    return this.usersService.setRole(admin.userId, id, dto.role);
  }

  @Get(':id')
  getUserById(@Param('id', ParseUUIDPipe) userId: string) {
    return this.usersService.findOne(userId);
  }
}
