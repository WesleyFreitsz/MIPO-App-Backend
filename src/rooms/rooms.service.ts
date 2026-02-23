import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Room,
  RoomType,
  ReservationStatus,
  RoomParticipant,
} from './entities/room.entity';
import {
  SalinhaReservation,
  ReservationApprovalStatus,
} from './entities/salinha-reservation.entity';
import { ChatsService } from '../chats/chats.service';
import { UsersService } from '../users/users.service';

interface JoinRoomDto {
  date: string;
  startTime: string;
  endTime: string;
  activity?: string;
  activityType?: 'game' | 'custom';
  isActivityPublic?: boolean;
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
  ) {}

  async findAll(skip = 0, take = 20, type?: RoomType, date?: string) {
    console.log(
      `[ROOMS] findAll chamado com: skip=${skip}, take=${take}, type=${type}, date=${date}`,
    );
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
    console.log(`[ROOMS] findAll retornou ${rooms.length} salas`);

    // Limpar atividades expiradas
    const cleanedRooms = rooms.map((room) => {
      this.cleanExpiredActivitiesInRoom(room);
      return room;
    });

    // Salvar rooms com atividades limpas
    await Promise.all(
      cleanedRooms.map((room) => this.roomsRepository.save(room)),
    );

    return cleanedRooms.map((r) => this.formatRoomResponse(r));
  }

  async findById(roomId: string) {
    console.log(`[ROOMS] Buscando sala com ID: ${roomId}`);
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['organizer'],
    });

    if (!room) {
      console.log(`[ROOMS] ❌ Sala não encontrada: ${roomId}`);
      throw new NotFoundException('Sala não encontrada.');
    }

    console.log(`[ROOMS] ✅ Sala encontrada: ${room.type}`);

    // Limpar atividades expiradas
    this.cleanExpiredActivitiesInRoom(room);
    await this.roomsRepository.save(room);

    return this.formatRoomResponse(room);
  }

  async joinRoom(roomId: string, userId: string, dto: JoinRoomDto) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['organizer'],
    });

    if (!room) {
      throw new NotFoundException('Sala não encontrada.');
    }

    // Limpar atividades expiradas antes de adicionar novo participante
    this.cleanExpiredActivitiesInRoom(room);

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    // Verificar se já é participante
    const isAlreadyMember = room.participants.some((p) => p.userId === userId);
    if (isAlreadyMember) {
      throw new BadRequestException('Você já está nesta sala.');
    }

    // Para salinha, só pode se marcar presença se tiver aprovação
    // Para outras salas, pode marcar presença sem aprovação
    if (
      room.type === RoomType.SALINHA &&
      room.reservationStatus !== ReservationStatus.APPROVED
    ) {
      throw new BadRequestException('Esta reserva ainda não foi aprovada.');
    }

    // Verificar conflito de horários na salinha
    if (room.type === RoomType.SALINHA) {
      const hasTimeConflict = room.participants.some((p) => {
        const userId1Start = parseInt(dto.startTime.split(':')[0] || '0');
        const userId1End = parseInt(dto.endTime.split(':')[0] || '23');
        const p2Start = parseInt(p.startTime.split(':')[0]);
        const p2End = parseInt(p.endTime.split(':')[0]);

        return userId1Start < p2End && userId1End > p2Start;
      });

      if (hasTimeConflict) {
        throw new BadRequestException(
          'Existe conflito de horário com outro participante nesta salinha.',
        );
      }
    }

    const startTime = dto.startTime || room.startTime;
    const endTime = dto.endTime || room.endTime;

    const newParticipant: RoomParticipant = {
      userId,
      name: user.name,
      activity: (dto.activity || room.activity || null) as string | null,
      activityType: (dto.activityType || room.activityType || null) as
        | 'game'
        | 'custom'
        | null,
      isActivityPublic: dto.isActivityPublic ?? true,
      startTime,
      endTime,
      joinedAt: new Date(),
    };

    room.participants.push(newParticipant);

    // Criar chat apenas se tiver organizador
    if (!room.chatId && room.organizerId) {
      const chat = await this.chatsService.createChat(room.organizerId, {
        name: `${room.type} - ${room.date}`,
      });
      room.chatId = (chat as any).id;
    }

    if (room.chatId && room.organizerId) {
      await this.chatsService.addMembers(room.chatId, room.organizerId, {
        memberIds: [userId],
      });
    }

    await this.roomsRepository.save(room);
    return this.formatRoomResponse(room);
  }

  async leaveRoom(roomId: string, userId: string) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Sala não encontrada.');
    }

    if (
      room.organizerId === userId &&
      room.type === RoomType.SALINHA &&
      room.reservationStatus === ReservationStatus.APPROVED
    ) {
      throw new ForbiddenException(
        'O organizador da salinha reservada não pode sair.',
      );
    }

    room.participants = room.participants.filter((p) => p.userId !== userId);

    if (room.participants.length === 0) {
      await this.roomsRepository.remove(room);
      return { message: 'Sala removida (sem participantes).' };
    }

    await this.roomsRepository.save(room);
    return { message: 'Você saiu da sala.' };
  }

  async approveReservation(roomId: string, userId: string) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Sala não encontrada.');
    }

    if (room.type !== RoomType.SALINHA) {
      throw new BadRequestException('Apenas salinhas precisam de aprovação.');
    }

    room.reservationStatus = ReservationStatus.APPROVED;
    await this.roomsRepository.save(room);

    return this.formatRoomResponse(room);
  }

  async cancelReservation(roomId: string, userId: string) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException('Sala não encontrada.');
    }

    if (room.organizerId !== userId && room.type === RoomType.SALINHA) {
      throw new ForbiddenException(
        'Apenas o organizador pode cancelar a reserva.',
      );
    }

    room.reservationStatus = ReservationStatus.CANCELLED;
    await this.roomsRepository.save(room);

    return this.formatRoomResponse(room);
  }

  async getRoomParticipantsByTimeSlot(
    roomId: string,
    date: string,
    startTime: string,
    endTime: string,
    userId?: string,
    isAdmin?: boolean,
  ) {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: ['organizer'],
    });

    if (!room) {
      throw new NotFoundException('Sala não encontrada.');
    }

    // Limpar atividades expiradas antes de retornar
    this.cleanExpiredActivitiesInRoom(room);
    await this.roomsRepository.save(room);

    if (room.date !== date) {
      return { participants: [], date, startTime, endTime };
    }

    // Filtrar participantes que estão no intervalo de horário
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);

    const filteredParticipants = room.participants
      .filter((p) => {
        const pStartHour = parseInt(p.startTime.split(':')[0]);
        const pEndHour = parseInt(p.endTime.split(':')[0]);

        return pStartHour < endHour && pEndHour > startHour;
      })
      .filter((p) => {
        // Filtrar atividades privadas: só mostrar se for admin ou dono
        if (p.isActivityPublic === false && !isAdmin && p.userId !== userId) {
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

  async reserveSalinha(
    userId: string,
    dto: {
      date: string;
      startTime: string;
      endTime: string;
      totalPrice: number;
    },
  ) {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    // Buscar a salinha fixa
    const salinha = await this.roomsRepository.findOne({
      where: { type: RoomType.SALINHA },
      relations: ['organizer'],
    });

    if (!salinha) {
      throw new NotFoundException('Salinha não encontrada.');
    }

    // Verificar conflito de horários
    const hasTimeConflict = salinha.participants.some((p) => {
      const userStartHour = parseInt(dto.startTime.split(':')[0]);
      const userEndHour = parseInt(dto.endTime.split(':')[0]);
      const pStartHour = parseInt(p.startTime.split(':')[0]);
      const pEndHour = parseInt(p.endTime.split(':')[0]);

      return userStartHour < pEndHour && userEndHour > pStartHour;
    });

    if (hasTimeConflict) {
      throw new BadRequestException(
        'Já existe uma reserva neste horário da salinha.',
      );
    }

    // Criar participante
    const newParticipant: RoomParticipant = {
      userId,
      name: user.name,
      activity: null,
      activityType: null,
      isActivityPublic: false,
      startTime: dto.startTime,
      endTime: dto.endTime,
      joinedAt: new Date(),
    };

    // Adicionar participante
    salinha.participants.push(newParticipant);
    salinha.reservationStatus = ReservationStatus.PENDING;

    // Criar chat se não existir
    if (!salinha.chatId && salinha.organizerId) {
      const chat = await this.chatsService.createChat(salinha.organizerId, {
        name: `Salinha - ${salinha.date}`,
      });
      salinha.chatId = (chat as any).id;
    }

    // Adicionar user ao chat
    if (salinha.chatId && salinha.organizerId) {
      await this.chatsService.addMembers(salinha.chatId, salinha.organizerId, {
        memberIds: [userId],
      });
    }

    await this.roomsRepository.save(salinha);

    // Criar registro de reserva para aprovação
    const reservation = this.reservationRepository.create({
      userId,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      totalPrice: dto.totalPrice,
      status: ReservationApprovalStatus.PENDING,
    });

    await this.reservationRepository.save(reservation);

    return {
      message: 'Reserva enviada para aprovação.',
      reservation: {
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        totalPrice: dto.totalPrice,
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
      startTime: r.startTime,
      endTime: r.endTime,
      totalPrice: r.totalPrice,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async approveSalinhaReservation(reservationId: string) {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException('Reserva não encontrada.');
    }

    reservation.status = ReservationApprovalStatus.APPROVED;
    reservation.approvedAt = new Date();
    await this.reservationRepository.save(reservation);

    // Atualizar status da salinha
    const salinha = await this.roomsRepository.findOne({
      where: { type: RoomType.SALINHA },
    });

    if (salinha) {
      salinha.reservationStatus = ReservationStatus.APPROVED;
      await this.roomsRepository.save(salinha);
    }

    return { message: 'Reserva aprovada com sucesso.' };
  }

  async rejectSalinhaReservation(reservationId: string, reason: string) {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
      relations: ['user'],
    });

    if (!reservation) {
      throw new NotFoundException('Reserva não encontrada.');
    }

    reservation.status = ReservationApprovalStatus.REJECTED;
    reservation.rejectionReason = reason;
    await this.reservationRepository.save(reservation);

    // Remover participante da salinha
    const salinha = await this.roomsRepository.findOne({
      where: { type: RoomType.SALINHA },
    });

    if (salinha) {
      salinha.participants = salinha.participants.filter(
        (p) => p.userId !== reservation.userId,
      );
      await this.roomsRepository.save(salinha);
    }

    return { message: 'Reserva rejeitada.', reason };
  }

  private cleanExpiredActivitiesInRoom(room: Room) {
    const now = new Date();
    const todayString = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    room.participants = room.participants.map((p) => {
      // Se a sala é de um dia anterior ao hoje, limpar atividades
      if (room.date < todayString) {
        return {
          ...p,
          activity: null,
          activityType: null,
        };
      }

      // Se é hoje, verificar se o endTime já passou
      if (room.date === todayString) {
        const [endHours, endMinutes] = p.endTime.split(':').map(Number);

        // Converter para minutos desde meia-noite para comparação mais fácil
        const endTimeInMinutes = endHours * 60 + endMinutes;
        const nowInMinutes = currentHours * 60 + currentMinutes;

        if (nowInMinutes > endTimeInMinutes) {
          return {
            ...p,
            activity: null,
            activityType: null,
          };
        }
      }

      return p;
    });
  }

  private formatRoomResponse(room: Room) {
    return {
      id: room.id,
      type: room.type,
      date: room.date,
      startTime: room.startTime,
      endTime: room.endTime,
      activity: room.activity,
      activityType: room.activityType,
      participants: room.participants,
      participantCount: room.participants.length,
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
