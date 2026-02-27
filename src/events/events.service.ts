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
import { AchievementsService } from 'src/achievements/achievements.service';
import { Achievement } from 'src/achievements/entities/achievement.entity';

@Injectable()

export class EventsService {
  constructor(
    @InjectRepository(Event) private eventRepository: Repository<Event>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Chat) private chatRepository: Repository<Chat>,
    // CORREÇÃO: Cada repositório deve ter seu próprio decorador na frente da variável
    @InjectRepository(Achievement)
    private achievementRepository: Repository<Achievement>,
    @InjectRepository(ChatMember)
    private chatMemberRepository: Repository<ChatMember>,
    private achievementsService: AchievementsService,
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
    await this.eventRepository.save(event);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.participation = (user.participation || 0) + 1;
      await this.userRepository.save(user);

      // 1. Gatilho por quantidade total acumulada: evento.checkin.X
      await this.achievementsService.checkAndAwardByCondition(
        userId,
        'evento.checkin',
        user.participation,
      );
    }

    // 2. Conquista específica vinculada a este evento (ID único)
    try {
      const linkedAchievement = await this.achievementRepository.findOne({
        where: { linkedEvent: { id: eventId } },
      });

      if (linkedAchievement) {
        await this.achievementsService.awardToUsers(
          [userId],
          linkedAchievement.id,
        );
      }
    } catch (error) {
      console.error('Erro ao processar conquista de evento:', error);
    }

    return { message: 'Check-in realizado com sucesso.' };
  }

  async findAllApproved() {
    await this.autoUpdateConcludedEvents();
    return this.eventRepository.find({
      where: { status: EventStatus.APPROVED },
      order: { dateTime: 'ASC' },
      relations: ['creator', 'participants'],
    });
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
      { eventId: event.id },
    );
    return event;
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
      // Uso do for...of no lugar de forEach para respeitar a assincronia do await
      for (const event of expiredEvents) {
        event.status = EventStatus.CONCLUDED;

        // Remove os membros e deleta o chat vinculado
        if (event.chatId) {
          await this.chatMemberRepository.delete({ chatId: event.chatId });
          await this.chatRepository.delete({ id: event.chatId });

          // 👇 RESOLVE O ERRO DE TIPAGEM AQUI 👇
          event.chatId = null as any;
        }
      }
      await this.eventRepository.save(expiredEvents);
    }
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
      // Se o ADMIN excluir manualmente, apaga membros e o chat
      if (event.chatId) {
        await this.chatMemberRepository.delete({ chatId: event.chatId });
        await this.chatRepository.delete({ id: event.chatId });
      }
      return this.eventRepository.remove(event);
    } else {
      if (event.creator.id !== reqUser.userId) {
        throw new ForbiddenException('Não autorizado.');
      }

      // Se o organizador cancelar o evento, apagamos o chat também
      if (event.chatId) {
        await this.chatMemberRepository.delete({ chatId: event.chatId });
        await this.chatRepository.delete({ id: event.chatId });

        // 👇 RESOLVE O ERRO DE TIPAGEM AQUI 👇
        event.chatId = null as any;
      }

      event.status = EventStatus.REPROVED;
      event.rejectionReason = 'Cancelado pelo organizador.';
      return this.eventRepository.save(event);
    }
  }
}
