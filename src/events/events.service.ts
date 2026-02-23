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
import { Chat, ChatType } from 'src/chats/entities/chat.entity';
import {
  ChatMember,
  ChatMemberRole,
} from 'src/chats/entities/chat-member.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event) private eventRepository: Repository<Event>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Chat) private chatRepository: Repository<Chat>, // ADICIONADO AQUI
    @InjectRepository(ChatMember)
    private chatMemberRepository: Repository<ChatMember>,
    private notifService: NotificationsService,
  ) {}

  async create(dto: any, reqUser: any) {
    const fullUser = await this.userRepository.findOne({
      where: { id: reqUser.userId },
    });
    if (!fullUser) throw new NotFoundException('Usuário não encontrado.');

    const isAdmin = fullUser.role === UserRole.ADMIN;

    // 1. Prepara os dados do evento
    const eventData = {
      ...dto,
      creator: fullUser,
      status: isAdmin ? EventStatus.APPROVED : EventStatus.PENDING,
      participants: [],
      checkedInUserIds: [],
    };

    // 2. Cria a instância e salva forçando a tipagem com "as unknown as Event"
    const newEvent = this.eventRepository.create(eventData);
    let savedEvent = (await this.eventRepository.save(
      newEvent,
    )) as unknown as Event;

    // 3. CRIA O CHAT VINCULADO AO EVENTO
    const chat = this.chatRepository.create({
      type: ChatType.EVENT,
      name: savedEvent.title,
      imageUrl: savedEvent.bannerUrl,
      createdByUserId: fullUser.id,
    });
    const savedChat = await this.chatRepository.save(chat);

    // 4. Adiciona o Criador como Admin do Chat do Evento
    const member = this.chatMemberRepository.create({
      chatId: savedChat.id,
      userId: fullUser.id,
      role: ChatMemberRole.ADMIN,
    });
    await this.chatMemberRepository.save(member);

    // 5. Salva o chatId de volta no evento
    savedEvent.chatId = savedChat.id;
    return this.eventRepository.save(savedEvent);
  }

  async findAllForAdmin() {
    return this.eventRepository.find({
      where: { status: Not(EventStatus.REPROVED) },
      order: { dateTime: 'ASC' },
      relations: ['creator'],
    });
  }

  async update(id: string, dto: any, reqUser: any) {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!event) throw new NotFoundException('Evento não encontrado');

    if (reqUser.role !== UserRole.ADMIN) {
      if (event.creator.id !== reqUser.userId) {
        throw new ForbiddenException(
          'Você só pode editar seus próprios eventos.',
        );
      }
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
      if (event.chatId) {
        await this.chatMemberRepository.delete({
          chatId: event.chatId,
          userId,
        });
      }
    } else {
      event.participants.push(user);
      if (event.chatId) {
        const existingMember = await this.chatMemberRepository.findOne({
          where: { chatId: event.chatId, userId },
        });
        if (!existingMember) {
          const newMember = this.chatMemberRepository.create({
            chatId: event.chatId,
            userId: userId,
            role: ChatMemberRole.MEMBER,
          });
          await this.chatMemberRepository.save(newMember);
        }
      }
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
