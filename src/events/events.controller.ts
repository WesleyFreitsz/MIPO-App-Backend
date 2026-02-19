import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/all')
  async findAllAdmin(@Request() req) {
    return this.eventsService.findAllForAdmin();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/checkin')
  async checkIn(@Param('id') id: string, @Request() req) {
    return this.eventsService.checkIn(id, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(@Request() req, @Body() dto: any) {
    return this.eventsService.create(dto, req.user);
  }

  @Get()
  async findAll() {
    return this.eventsService.findAllApproved();
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.eventsService.update(id, dto, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/toggle')
  async toggleParticipation(@Param('id') id: string, @Request() req) {
    return this.eventsService.toggleParticipation(id, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('pending')
  async findPending(@Request() req) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException();
    return this.eventsService.findPending();
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    return this.eventsService.approve(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body('reason') reason: string) {
    return this.eventsService.reprove(id, reason);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    return this.eventsService.remove(id, req.user);
  }
}
