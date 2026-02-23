import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
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
    @Query('type') type?: string,
    @Query('date') date?: string,
  ) {
    return this.roomsService.findAll(
      Number(skip),
      Number(take),
      type as any,
      date,
    );
  }

  @Get('debug/all')
  async debugAllRooms() {
    return this.roomsService.findAll(0, 100);
  }

  @Get(':id')
  async findById(@Param('id') roomId: string) {
    return this.roomsService.findById(roomId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/join')
  async join(
    @Param('id') roomId: string,
    @Request() req: any,
    @Body()
    dto: {
      date: string;
      startTime: string;
      endTime: string;
      activity?: string;
      activityType?: 'game' | 'custom';
      isActivityPublic?: boolean;
    },
  ) {
    return this.roomsService.joinRoom(roomId, req.user.userId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/leave')
  async leave(@Param('id') roomId: string, @Request() req: any) {
    return this.roomsService.leaveRoom(roomId, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/approve')
  async approveReservation(@Param('id') roomId: string, @Request() req: any) {
    const room = await this.roomsService.findById(roomId);
    if (room.organizerId !== req.user.userId) {
      throw new ForbiddenException(
        'Apenas o organizador pode aprovar a reserva.',
      );
    }
    return this.roomsService.approveReservation(roomId, req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/cancel')
  async cancelReservation(@Param('id') roomId: string, @Request() req: any) {
    return this.roomsService.cancelReservation(roomId, req.user.userId);
  }

  @Get(':id/participants')
  async getParticipantsByTimeSlot(
    @Param('id') roomId: string,
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.roomsService.getRoomParticipantsByTimeSlot(
      roomId,
      date,
      startTime,
      endTime,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('salinha/reserve')
  async reserveSalinha(
    @Request() req: any,
    @Body()
    dto: {
      date: string;
      startTime: string;
      endTime: string;
      totalPrice: number;
    },
  ) {
    return this.roomsService.reserveSalinha(req.user.userId, dto);
  }

  @Get('salinha/reservations/pending')
  async getPendingReservations() {
    return this.roomsService.getPendingReservations();
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('salinha/reservations/:id/approve')
  async approveSalinhaReservation(@Param('id') reservationId: string) {
    return this.roomsService.approveSalinhaReservation(reservationId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('salinha/reservations/:id/reject')
  async rejectSalinhaReservation(
    @Param('id') reservationId: string,
    @Body() dto: { reason: string },
  ) {
    return this.roomsService.rejectSalinhaReservation(
      reservationId,
      dto.reason,
    );
  }
}
