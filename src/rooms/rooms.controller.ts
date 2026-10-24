import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { OptionalJwtAuthGuard } from 'src/auth/optional-jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { UserRole } from 'src/users/entities/user.entity';
import { JoinRoomDto } from './dto/join-room.dto';
import { ReserveSalinhaDto } from './dto/reserve-salinha.dto';
import {
  RejectReservationDto,
  RoomParticipantsQueryDto,
  RoomsQueryDto,
} from './dto/rooms-query.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async findAll(
    @Query() query: RoomsQueryDto,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.roomsService.findAll(
      query.skip,
      query.take,
      query.type,
      query.date,
      viewer,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('salinha/reservations/pending')
  async getPendingReservations() {
    return this.roomsService.getPendingReservations();
  }

  @UseGuards(JwtAuthGuard)
  @Post('salinha/reserve')
  async reserveSalinha(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReserveSalinhaDto,
  ) {
    return this.roomsService.reserveSalinha(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('salinha/reservations/:id/approve')
  async approveSalinhaReservation(
    @Param('id', ParseUUIDPipe) reservationId: string,
  ) {
    return this.roomsService.approveSalinhaReservation(reservationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('salinha/reservations/:id/reject')
  async rejectSalinhaReservation(
    @Param('id', ParseUUIDPipe) reservationId: string,
    @Body() dto: RejectReservationDto,
  ) {
    return this.roomsService.rejectSalinhaReservation(
      reservationId,
      dto.reason ?? '',
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findById(
    @Param('id') roomId: string,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.roomsService.findById(roomId, viewer);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/participants')
  async getParticipantsByTimeSlot(
    @Param('id') roomId: string,
    @Query() query: RoomParticipantsQueryDto,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return this.roomsService.getRoomParticipantsByTimeSlot(
      roomId,
      query.date,
      query.startTime,
      query.endTime,
      viewer,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') roomId: string,
    @Body() dto: JoinRoomDto,
  ) {
    return this.roomsService.joinRoom(roomId, user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  async leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') roomId: string,
  ) {
    return this.roomsService.leaveRoom(roomId, user.userId);
  }
}
