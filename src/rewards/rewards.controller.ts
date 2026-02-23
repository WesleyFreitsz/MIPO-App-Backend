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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RewardsService } from './rewards.service';
import { UserRole } from 'src/users/entities/user.entity';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  async findAll() {
    return this.rewardsService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(
    @Body() dto: { title: string; price: number; stock: number },
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem criar recompensas.');
    }
    return this.rewardsService.create(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<{ title: string; price: number; stock: number }>,
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem editar recompensas.');
    }
    return this.rewardsService.update(id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    if (req?.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem excluir recompensas.');
    }
    return this.rewardsService.remove(id);
  }
}
