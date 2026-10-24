import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { UserRole } from 'src/users/entities/user.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RejectEventDto } from './dto/reject-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async findAll() {
    return this.eventsService.findAllApproved();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/all')
  async findAllAdmin() {
    return this.eventsService.findAllForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('pending')
  async findPending() {
    return this.eventsService.findPending();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/checkin')
  async checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventsService.checkIn(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/toggle')
  async toggleParticipation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventsService.toggleParticipation(id, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/approve')
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.approve(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectEventDto,
  ) {
    return this.eventsService.reprove(id, dto.reason ?? '');
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.eventsService.remove(id, user);
  }
}
