import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  Req,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AchievementsService } from './achievements.service';
import { UserRole } from 'src/users/entities/user.entity';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('sync/:userId')
  async syncUserAchievements(
    @Param('userId') userId: string,
    @Body() dto: { prefix: string; count: number },
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso negado.');
    await this.achievementsService.checkAndAwardByCondition(
      userId,
      dto.prefix,
      dto.count,
    );
    return { message: 'Sincronização concluída.' };
  }

  @Get()
  async findAll(@Query('userId') userId?: string) {
    return this.achievementsService.findAll(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(
    @Body()
    dto: {
      title: string;
      icon: string;
      description?: string;
      condition?: string;
      rarityId?: string;
      eventId?: string;
    },
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso negado.');
    return this.achievementsService.create(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso negado.');
    return this.achievementsService.update(id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso negado.');
    return this.achievementsService.remove(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('award')
  async awardToUsers(
    @Body() dto: { userIds: string[]; achievementId: string },
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso negado.');
    return this.achievementsService.awardToUsers(
      dto.userIds,
      dto.achievementId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id/user/:userId')
  async removeAchievementFromUser(
    @Param('id') achievementId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso negado.');
    return this.achievementsService.removeAchievementFromUser(
      userId,
      achievementId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('highlights')
  async setHighlights(
    @Body() dto: { achievementIds: string[] },
    @Req() req: any,
  ) {
    return this.achievementsService.setHighlights(
      req.user.userId,
      dto.achievementIds,
    );
  }

  @Get('rarities')
  async findAllRarities() {
    return this.achievementsService.findAllRarities();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('rarities')
  async createRarity(
    @Body() dto: { name: string; color: string },
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso negado.');
    return this.achievementsService.createRarity(dto.name, dto.color);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('rarities/:id')
  async updateRarity(
    @Param('id') id: string,
    @Body() dto: { name: string; color: string },
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso negado.');
    return this.achievementsService.updateRarity(id, dto.name, dto.color);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('rarities/:id')
  async removeRarity(@Param('id') id: string, @Req() req: any) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso negado.');
    return this.achievementsService.removeRarity(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('rarities/order')
  async updateRaritiesOrder(
    @Body() dto: { rarityIds: string[] },
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso negado.');
    return this.achievementsService.updateRaritiesOrder(dto.rarityIds);
  }
}
