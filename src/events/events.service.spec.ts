import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AchievementsService } from 'src/achievements/achievements.service';
import { Achievement } from 'src/achievements/entities/achievement.entity';
import { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { Chat } from 'src/chats/entities/chat.entity';
import { ChatMember } from 'src/chats/entities/chat-member.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Event, EventStatus } from './entities/event.entity';
import { EventsService } from './events.service';
import { UpdateEventDto } from './dto/update-event.dto';

const regularUser: AuthenticatedUser = {
  userId: 'creator',
  name: 'Ana',
  role: UserRole.USER,
};

describe('EventsService', () => {
  let eventRepository: { findOne: jest.Mock; save: jest.Mock };
  let userRepository: { findOne: jest.Mock; increment: jest.Mock };
  let service: EventsService;

  beforeEach(() => {
    eventRepository = {
      findOne: jest.fn(),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
    userRepository = { findOne: jest.fn(), increment: jest.fn() };

    service = new EventsService(
      eventRepository as unknown as Repository<Event>,
      userRepository as unknown as Repository<User>,
      {} as Repository<Chat>,
      { findOne: jest.fn() } as unknown as Repository<Achievement>,
      {} as Repository<ChatMember>,
      {
        checkAndAwardByCondition: jest.fn(),
        awardToUsers: jest.fn(),
      } as unknown as AchievementsService,
      { broadcast: jest.fn() } as unknown as NotificationsService,
    );
  });

  it('criador comum não consegue aprovar o próprio evento pelo update', async () => {
    eventRepository.findOne.mockResolvedValue({
      id: 'e1',
      title: 'Noite de jogos',
      status: EventStatus.APPROVED,
      creator: { id: 'creator' },
    });

    const dto = {
      title: 'Noite de jogos 2',
      status: EventStatus.APPROVED,
    } as UpdateEventDto;

    const saved = await service.update('e1', dto, regularUser);

    expect(saved.title).toBe('Noite de jogos 2');
    expect(saved.status).toBe(EventStatus.PENDING);
  });

  it('não deixa editar evento de outra pessoa', async () => {
    eventRepository.findOne.mockResolvedValue({
      id: 'e1',
      creator: { id: 'outra-pessoa' },
    });

    await expect(
      service.update('e1', { title: 'x' }, regularUser),
    ).rejects.toThrow(ForbiddenException);
  });

  it('não faz check-in de quem não confirmou presença', async () => {
    eventRepository.findOne.mockResolvedValue({
      id: 'e1',
      status: EventStatus.APPROVED,
      dateTime: new Date(Date.now() - 60_000),
      participants: [{ id: 'outra-pessoa' }],
      checkedInUserIds: [],
    });

    await expect(service.checkIn('e1', 'creator')).rejects.toThrow(
      ForbiddenException,
    );
    expect(userRepository.increment).not.toHaveBeenCalled();
  });

  it('não faz check-in depois que o período acabou', async () => {
    eventRepository.findOne.mockResolvedValue({
      id: 'e1',
      status: EventStatus.APPROVED,
      dateTime: new Date(Date.now() - 7 * 60 * 60 * 1000),
      participants: [{ id: 'creator' }],
      checkedInUserIds: [],
    });

    await expect(service.checkIn('e1', 'creator')).rejects.toThrow(
      BadRequestException,
    );
  });
});
