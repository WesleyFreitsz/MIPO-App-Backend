import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { User, UserRole } from 'src/users/entities/user.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notifService: NotificationsService,
  ) {}

  async create(dto: any, reqUser: any) {
    const fullUser = await this.userRepository.findOne({
      where: { id: reqUser.userId },
    });
    if (!fullUser) throw new NotFoundException('Usuário não encontrado.');

    const isAdmin = fullUser.role === UserRole.ADMIN;
    const event = this.eventRepository.create({
      ...dto,
      creator: fullUser,
      status: isAdmin ? EventStatus.APPROVED : EventStatus.PENDING,
      participants: [],
      checkedInUserIds: [],
    });

    return this.eventRepository.save(event);
  }

  // Novo método para Admin: Lista tudo exceto REPROVED (cancelados)
  async findAllForAdmin() {
    return this.eventRepository.find({
      where: { status: Not(EventStatus.REPROVED) },
      order: { dateTime: 'ASC' },
      relations: ['creator'],
    });
  }

  // Atualização com lógica de permissão e status
  async update(id: string, dto: any, reqUser: any) {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!event) throw new NotFoundException('Evento não encontrado');

    // Se não for admin, verifica se é o dono
    if (reqUser.role !== UserRole.ADMIN) {
      if (event.creator.id !== reqUser.userId) {
        throw new ForbiddenException(
          'Você só pode editar seus próprios eventos.',
        );
      }
      // Se um usuário edita, volta para PENDING para nova análise
      event.status = EventStatus.PENDING;
    }

    Object.assign(event, dto);
    return this.eventRepository.save(event);
  }

  async toggleParticipation(eventId: string, userId: string) {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['participants'],
    });

    if (!event) throw new NotFoundException('Evento não encontrado');

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const isParticipating = event.participants.some((p) => p.id === userId);

    if (isParticipating) {
      event.participants = event.participants.filter((p) => p.id !== userId);
    } else {
      event.participants.push(user);
    }

    return this.eventRepository.save(event);
  }

  async checkIn(eventId: string, userId: string) {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['participants'],
    });

    if (!event) throw new NotFoundException('Evento não encontrado');

    if (new Date() < event.dateTime) {
      throw new BadRequestException(
        'O check-in só é permitido no horário de início.',
      );
    }

    if (!event.checkedInUserIds) event.checkedInUserIds = [];
    if (event.checkedInUserIds.includes(userId)) {
      throw new BadRequestException('Check-in já realizado para este evento.');
    }

    event.checkedInUserIds.push(userId);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.participation += 1;
      await this.userRepository.save(user);
    }

    return this.eventRepository.save(event);
  }

  async findAllApproved() {
    await this.autoUpdateConcludedEvents();
    return this.eventRepository.find({
      where: { status: EventStatus.APPROVED },
      order: { dateTime: 'ASC' },
      relations: ['creator', 'participants'],
    });
  }

  private async autoUpdateConcludedEvents() {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const expiredEvents = await this.eventRepository.find({
      where: {
        status: EventStatus.APPROVED,
        dateTime: LessThan(sixHoursAgo),
      },
    });

    if (expiredEvents.length > 0) {
      expiredEvents.forEach((event) => {
        event.status = EventStatus.CONCLUDED;
      });
      await this.eventRepository.save(expiredEvents);
    }
  }

  async findPending() {
    return this.eventRepository.find({
      where: { status: EventStatus.PENDING },
      order: { createdAt: 'DESC' },
      relations: ['creator'],
    });
  }

  async approve(eventId: string) {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['creator'],
    });
    if (!event) throw new NotFoundException('Evento não encontrado');

    event.status = EventStatus.APPROVED;
    await this.eventRepository.save(event);
    await this.notifService.broadcast(
      'Novo Evento!',
      `O evento "${event.title}" foi confirmado!`,
      'calendar',
    );
    return event;
  }

  async reprove(eventId: string, reason: string) {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['creator'],
    });
    if (!event) throw new NotFoundException('Evento não encontrado');

    event.status = EventStatus.REPROVED;
    event.rejectionReason = reason;
    return this.eventRepository.save(event);
  }

  async remove(id: string, reqUser: any) {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!event) throw new NotFoundException('Evento não encontrado');

    // Admin deleta qualquer um; Usuário cancela o próprio (muda status para REPROVED)
    if (reqUser.role === UserRole.ADMIN) {
      return this.eventRepository.remove(event);
    } else {
      if (event.creator.id !== reqUser.userId) {
        throw new ForbiddenException('Não autorizado.');
      }
      event.status = EventStatus.REPROVED;
      event.rejectionReason = 'Cancelado pelo organizador.';
      return this.eventRepository.save(event);
    }
  }
}
