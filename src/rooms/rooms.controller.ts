import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async findAll(
    @Query('skip') skip = 0,
    @Query('take') take = 20,
  ) {
    return this.roomsService.findAll(Number(skip), Number(take));
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(
    @Request() req: any,
    @Body() dto: {
      game: string;
      date: string;
      time: string;
      maxParticipants?: number;
      isPublic?: boolean;
      description?: string;
    },
  ) {
    return this.roomsService.create(req.user.userId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/join')
  async join(@Param('id') roomId: string, @Request() req: any) {
    return this.roomsService.join(roomId, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') roomId: string, @Request() req: any) {
    return this.roomsService.remove(roomId, req.user.userId);
  }
}
