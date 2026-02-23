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
import { GamesService } from './games.service';
import { UserRole } from 'src/users/entities/user.entity';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  async findAll(@Query() query: any) {
    return this.gamesService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.gamesService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(
    @Body()
    dto: {
      name: string;
      description?: string;
      category: string[]; // Aceita array agora
      minPlayers: number;
      maxPlayers: number;
      imageUrl: string;
      videoUrl?: string;
      isFeatured?: boolean;
    },
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Apenas administradores podem cadastrar jogos.',
      );
    }
    return this.gamesService.create(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<any>,
    @Req() req: any,
  ) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Apenas admins podem editar.');
    return this.gamesService.update(id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/feature')
  async toggleFeature(@Param('id') id: string, @Req() req: any) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Apenas admins podem destacar.');
    return this.gamesService.toggleFeatured(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    if (req?.user?.role !== UserRole.ADMIN)
      throw new ForbiddenException('Apenas admins podem excluir.');
    return this.gamesService.remove(id);
  }
}
