import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { UserRole } from 'src/users/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import {
  AwardAchievementDto,
  CreateAchievementDto,
  RarityDto,
  RarityOrderDto,
  SetHighlightsDto,
  SyncAchievementsDto,
  UpdateAchievementDto,
} from './dto/achievement.dto';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  async findAll(
    @Query('userId', new ParseUUIDPipe({ optional: true })) userId?: string,
  ) {
    return this.achievementsService.findAll(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.achievementsService.findAllWithProgress(user.userId);
  }

  @Get('rarities')
  async findAllRarities() {
    return this.achievementsService.findAllRarities();
  }

  @UseGuards(JwtAuthGuard)
  @Post('highlights')
  async setHighlights(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetHighlightsDto,
  ) {
    return this.achievementsService.setHighlights(
      user.userId,
      dto.achievementIds,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('sync/:userId')
  async syncUserAchievements(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SyncAchievementsDto,
  ) {
    await this.achievementsService.checkAndAwardByCondition(
      userId,
      dto.prefix,
      dto.count,
    );
    return { message: 'Sincronização concluída.' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() dto: CreateAchievementDto) {
    return this.achievementsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('award')
  async awardToUsers(@Body() dto: AwardAchievementDto) {
    return this.achievementsService.awardToUsers(
      dto.userIds,
      dto.achievementId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('rarities')
  async createRarity(@Body() dto: RarityDto) {
    return this.achievementsService.createRarity(dto.name, dto.color);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('rarities/order')
  async updateRaritiesOrder(@Body() dto: RarityOrderDto) {
    return this.achievementsService.updateRaritiesOrder(dto.rarityIds);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('rarities/:id')
  async updateRarity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RarityDto,
  ) {
    return this.achievementsService.updateRarity(id, dto.name, dto.color);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('rarities/:id')
  async removeRarity(@Param('id', ParseUUIDPipe) id: string) {
    return this.achievementsService.removeRarity(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAchievementDto,
  ) {
    return this.achievementsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id/user/:userId')
  async removeAchievementFromUser(
    @Param('id', ParseUUIDPipe) achievementId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.achievementsService.removeAchievementFromUser(
      userId,
      achievementId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.achievementsService.remove(id);
  }
}
