import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Room, RoomType, RoomParticipant } from './entities/room.entity';
import {
  SalinhaReservation,
  ReservationApprovalStatus,
} from './entities/salinha-reservation.entity';
import { ChatsService } from '../chats/chats.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { UserRole } from '../users/entities/user.entity';
import { JoinRoomDto } from './dto/join-room.dto';
import { ReserveSalinhaDto } from './dto/reserve-salinha.dto';
import {
  minutesNowInRoomsTimeZone,
  normalizeTime,
  timeRangesOverlap,
  timeToMinutes,
  todayInRoomsTimeZone,
} from './room-time.util';

export const SALINHA_HOURLY_RATE = 10;

export function calculateSalinhaPrice(startTime: string, endTime: string) {
  const startHour = Number(startTime.split(':')[0]);
  const endHour = Number(endTime.split(':')[0]);
  return Math.max(1, endHour - startHour) * SALINHA_HOURLY_RATE;
}

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
    @InjectRepository(SalinhaReservation)
    private reservationRepository: Repository<SalinhaReservation>,
    private chatsService: ChatsService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(
    skip = 0,
    take = 20,
    type?: RoomType,
    date?: string,
    viewer?: AuthenticatedUser,
  ) {
    const query = this.roomsRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.organizer', 'organizer')
      .orderBy('room.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (type) {
      query.where('room.type = :type', { type });
    }

    if (date) {
      query.andWhere('room.date = :date', { date });
    }

    const rooms = await query.getMany();
    return Promise.all(
      rooms.map(async (room) => {
        await this.ensureCurrentDay(room);
        return this.buildRoomResponse(room, viewer);
      }),
    );
  }

  async findById(roomId: string, viewer?: AuthenticatedUser) {
    const room = await this.findRoomOrFail(roomId);
    await this.ensureCurrentDay(room);
    return this.buildRoomResponse(room, viewer);
  }

  async joinRoom(roomId: string, userId: string, dto: JoinRoomDto) {
    const room = await this.findRoomOrFail(roomId);
    await this.ensureCurrentDay(room);

    if (room.type === RoomType.SALINHA) {
      throw new BadRequestException(
        'Para usar a salinha, faça uma reserva e aguarde a aprovação.',
      );
    }

    if (dto.date !== room.date) {
      throw new BadRequestException(
        'Só é possível marcar presença para o dia de hoje.',
      );
    }

    this.assertValidTimeRange(dto.startTime, dto.endTime);

    const user = await this.usersService.findOne(userId);

    // Verificar se já é participante
    const isAlreadyMember = room.participants.some((p) => p.userId === userId);
    if (isAlreadyMember) {
      throw new BadRequestException('Você já está nesta sala.');
    }

    const newParticipant: RoomParticipant = {
      userId,
      name: user.name,
      activity: dto.activity || room.activity || null,
      activityType: dto.activityType || room.activityType || null,
      isActivityPublic: dto.isActivityPublic ?? true,
      startTime: normalizeTime(dto.startTime),
      endTime: normalizeTime(dto.endTime),
      joinedAt: new Date(),
    };

    room.participants.push(newParticipant);

    // Criar chat apenas se tiver organizador
    if (!room.chatId && room.organizerId) {
      const chat = await this.chatsService.createChat(room.organizerId, {
        name: `${room.type} - ${room.date}`,
      });
      room.chatId = chat.id;
    }

    if (room.chatId && room.organizerId) {
      await this.chatsService.addMembers(room.chatId, room.organizerId, {
        memberIds: [userId],
      });
    }

    await this.roomsRepository.save(room);
    return this.buildRoomResponse(room, {
      userId,
      name: user.name,
      role: user.role,
    });
  }

  async leaveRoom(roomId: string, userId: string) {
    const room = await this.findRoomOrFail(roomId);

    if (!room.participants.some((p) => p.userId === userId)) {
      throw new BadRequestException('Você não está nesta sala.');
    }

    room.participants = room.participants.filter((p) => p.userId !== userId);
    await this.roomsRepository.save(room);
    return { message: 'Você saiu da sala.' };
  }

  async getRoomParticipantsByTimeSlot(
    roomId: string,
    date: string,
    startTime: string,
    endTime: string,
    viewer?: AuthenticatedUser,
  ) {
    const room = await this.findRoomOrFail(roomId);
    await this.ensureCurrentDay(room);

    const participants =
      room.type === RoomType.SALINHA
        ? await this.approvedSalinhaParticipants(date)
        : room.date === date
          ? this.withoutExpiredActivities(room.date, room.participants)
          : [];

    const isAdmin = viewer?.role === UserRole.ADMIN;
    const filteredParticipants = participants
      .filter((p) =>
        timeRangesOverlap(p.startTime, p.endTime, startTime, endTime),
      )
      .filter((p) => {
        // Filtrar atividades privadas: só mostrar se for admin ou dono
        if (
          p.isActivityPublic === false &&
          !isAdmin &&
          p.userId !== viewer?.userId
        ) {
          return false;
        }
        return true;
      });

    return {
      participants: filteredParticipants,
      date,
      startTime,
      endTime,
    };
  }

  async reserveSalinha(userId: string, dto: ReserveSalinhaDto) {
    const user = await this.usersService.findOne(userId);

    const salinha = await this.roomsRepository.findOne({
      where: { type: RoomType.SALINHA },
    });
    if (!salinha) {
      throw new NotFoundException('Salinha não encontrada.');
    }

    this.assertValidTimeRange(dto.startTime, dto.endTime);

    const today = todayInRoomsTimeZone();
    if (dto.date < today) {
      throw new BadRequestException(
        'Não é possível reservar uma data passada.',
      );
    }
    if (
      dto.date === today &&
      timeToMinutes(dto.startTime) < minutesNowInRoomsTimeZone()
    ) {
      throw new BadRequestException(
        'Não é possível reservar um horário que já passou.',
      );
    }

    const activeReservations = await this.reservationRepository.find({
      where: {
        date: dto.date,
        status: In([
          ReservationApprovalStatus.PENDING,
          ReservationApprovalStatus.APPROVED,
        ]),
      },
    });

    const hasTimeConflict = activeReservations.some((r) =>
      timeRangesOverlap(dto.startTime, dto.endTime, r.startTime, r.endTime),
    );
    if (hasTimeConflict) {
      throw new BadRequestException(
        'Já existe uma reserva neste horário da salinha.',
      );
    }

    const totalPrice = calculateSalinhaPrice(dto.startTime, dto.endTime);

    const reservation = this.reservationRepository.create({
      userId,
      date: dto.date,
      startTime: normalizeTime(dto.startTime),
      endTime: normalizeTime(dto.endTime),
      totalPrice,
      status: ReservationApprovalStatus.PENDING,
    });
    await this.reservationRepository.save(reservation);

    await this.notificationsService.notifyAdmins(
      'Nova reserva da salinha',
      `${user.nickname || user.name} pediu a salinha em ${dto.date}, das ${normalizeTime(dto.startTime)} às ${normalizeTime(dto.endTime)}.`,
      { reservationId: reservation.id },
    );

    return {
      message: 'Reserva enviada para aprovação.',
      reservation: {
        id: reservation.id,
        date: reservation.date,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        totalPrice,
      },
    };
  }

  async getPendingReservations() {
    const reservations = await this.reservationRepository.find({
      where: { status: ReservationApprovalStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    return reservations.map((r) => ({
      id: r.id,
      userId: r.userId,
      user: r.user ? { name: r.user.name } : null,
      date: r.date,
      startTime: normalizeTime(r.startTime),
      endTime: normalizeTime(r.endTime),
      totalPrice: Number(r.totalPrice),
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async approveSalinhaReservation(reservationId: string) {
    const reservation = await this.findReservationOrFail(reservationId);

    if (reservation.status !== ReservationApprovalStatus.PENDING) {
      throw new BadRequestException('Esta reserva já foi processada.');
    }

    const approvedSameDay = await this.reservationRepository.find({
      where: {
        date: reservation.date,
        status: ReservationApprovalStatus.APPROVED,
      },
    });
    const conflicts = approvedSameDay.some((r) =>
      timeRangesOverlap(
        reservation.startTime,
        reservation.endTime,
        r.startTime,
        r.endTime,
      ),
    );
    if (conflicts) {
      throw new BadRequestException(
        'Já existe uma reserva aprovada neste horário.',
      );
    }

    reservation.status = ReservationApprovalStatus.APPROVED;
    reservation.approvedAt = new Date();
    await this.reservationRepository.save(reservation);

    await this.notificationsService.sendToUser(
      reservation.userId,
      'Reserva aprovada! 🎲',
      `Sua reserva da salinha em ${reservation.date}, das ${normalizeTime(reservation.startTime)} às ${normalizeTime(reservation.endTime)}, foi aprovada.`,
      'calendar',
      'ALERT',
      { reservationId: reservation.id },
    );

    return { message: 'Reserva aprovada com sucesso.' };
  }

  async rejectSalinhaReservation(reservationId: string, reason: string) {
    const reservation = await this.findReservationOrFail(reservationId);

    if (reservation.status === ReservationApprovalStatus.REJECTED) {
      throw new BadRequestException('Esta reserva já foi rejeitada.');
    }

    reservation.status = ReservationApprovalStatus.REJECTED;
    reservation.rejectionReason = reason || null;
    await this.reservationRepository.save(reservation);

    await this.notificationsService.sendToUser(
      reservation.userId,
      'Reserva não aprovada',
      reason
        ? `Sua reserva da salinha em ${reservation.date} foi rejeitada: ${reason}`
        : `Sua reserva da salinha em ${reservation.date} foi rejeitada.`,
      'calendar',
      'ALERT',
      { reservationId: reservation.id },
    );

    return { message: 'Reserva rejeitada.', reason };
  }

  private async findRoomOrFail(roomId: string) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['organizer'],
    });
    if (!room) {
      throw new NotFoundException('Sala não encontrada.');
    }
    return room;
  }

  private async findReservationOrFail(reservationId: string) {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
    });
    if (!reservation) {
      throw new NotFoundException('Reserva não encontrada.');
    }
    return reservation;
  }

  private assertValidTimeRange(startTime: string, endTime: string) {
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      throw new BadRequestException(
        'O horário de término deve ser posterior ao horário de início.',
      );
    }
  }

  private async ensureCurrentDay(room: Room) {
    const today = todayInRoomsTimeZone();
    if (room.date < today) {
      room.date = today;
      room.participants = [];
      await this.roomsRepository.save(room);
    }
  }

  private async approvedSalinhaParticipants(
    date: string,
  ): Promise<RoomParticipant[]> {
    const reservations = await this.reservationRepository.find({
      where: { date, status: ReservationApprovalStatus.APPROVED },
      relations: ['user'],
      order: { startTime: 'ASC' },
    });

    return reservations.map((r) => ({
      userId: r.userId,
      name: r.user?.nickname || r.user?.name || 'Reserva',
      activity: null,
      activityType: null,
      isActivityPublic: false,
      startTime: normalizeTime(r.startTime),
      endTime: normalizeTime(r.endTime),
      joinedAt: r.approvedAt ?? r.createdAt,
    }));
  }

  private withoutExpiredActivities(
    roomDate: string,
    participants: RoomParticipant[],
  ): RoomParticipant[] {
    const today = todayInRoomsTimeZone();
    const nowInMinutes = minutesNowInRoomsTimeZone();

    return participants.map((p) => {
      const expired =
        roomDate < today ||
        (roomDate === today && nowInMinutes > timeToMinutes(p.endTime));
      return expired ? { ...p, activity: null, activityType: null } : p;
    });
  }

  private maskPrivateActivities(
    participants: RoomParticipant[],
    viewer?: AuthenticatedUser,
  ): RoomParticipant[] {
    const isAdmin = viewer?.role === UserRole.ADMIN;
    return participants.map((p) =>
      p.isActivityPublic === false && !isAdmin && p.userId !== viewer?.userId
        ? { ...p, activity: null, activityType: null }
        : p,
    );
  }

  private async buildRoomResponse(room: Room, viewer?: AuthenticatedUser) {
    const participants =
      room.type === RoomType.SALINHA
        ? await this.approvedSalinhaParticipants(room.date)
        : this.withoutExpiredActivities(room.date, room.participants);

    const visibleParticipants = this.maskPrivateActivities(
      participants,
      viewer,
    );

    return {
      id: room.id,
      type: room.type,
      date: room.date,
      startTime: room.startTime,
      endTime: room.endTime,
      activity: room.activity,
      activityType: room.activityType,
      participants: visibleParticipants,
      participantCount: visibleParticipants.length,
      organizer: room.organizer
        ? { id: room.organizer.id, name: room.organizer.name }
        : null,
      organizerId: room.organizerId,
      reservationStatus: room.reservationStatus,
      chatId: room.chatId,
      createdAt: room.createdAt,
    };
  }
}
