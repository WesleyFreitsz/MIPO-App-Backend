import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { UserRole } from 'src/users/entities/user.entity';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  CreateGameDto,
  GamesQueryDto,
  UpdateGameDto,
  UpdateGameUserMarkDto,
} from './dto/game.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  async findAll(@Query() query: GamesQueryDto) {
    return this.gamesService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/marks')
  async findMyMarks(@CurrentUser() user: AuthenticatedUser) {
    return this.gamesService.findMyMarks(user.userId);
  }

  @Get(':id/reviews')
  async findReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.gamesService.findReviews(id, query.skip, query.take);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/my-mark')
  async updateMyMark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGameUserMarkDto,
  ) {
    return this.gamesService.updateMyMark(id, user.userId, dto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.gamesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() dto: CreateGameDto) {
    return this.gamesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/feature')
  async toggleFeature(@Param('id', ParseUUIDPipe) id: string) {
    return this.gamesService.toggleFeatured(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGameDto,
  ) {
    return this.gamesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gamesService.remove(id);
  }
}
