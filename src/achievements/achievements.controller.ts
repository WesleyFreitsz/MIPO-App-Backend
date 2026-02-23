import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AchievementsService } from './achievements.service';
import { UserRole } from 'src/users/entities/user.entity';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  async findAll() {
    return this.achievementsService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Body() dto: { title: string; icon?: string }, @Req() req: any) {
    if (req?.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem criar conquistas.');
    }
    return this.achievementsService.create(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    if (req?.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem excluir conquistas.');
    }
    return this.achievementsService.remove(id);
  }
}
