import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Friendship } from 'src/friends/entities/friendship.entity';
import { AchievementsService } from 'src/achievements/achievements.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { NotificationsService } from 'src/notifications/notifications.service';
import { StoreVisitsService } from './store-visits.service';
import { StoreVisit } from './entities/store-visit.entity';
import { StoreCheckinCode } from './entities/store-checkin-code.entity';

const repoMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  count: jest.fn().mockResolvedValue(1),
  exists: jest.fn(),
  save: jest.fn((entity: unknown) =>
    Promise.resolve({ id: 'v1', ...(entity as object) }),
  ),
  create: jest.fn((entity: unknown) => entity),
});

describe('StoreVisitsService', () => {
  let visits: ReturnType<typeof repoMock>;
  let codes: ReturnType<typeof repoMock>;
  let emit: jest.Mock;
  let service: StoreVisitsService;

  beforeEach(() => {
    visits = repoMock();
    codes = repoMock();
    emit = jest.fn();
    service = new StoreVisitsService(
      visits as unknown as Repository<StoreVisit>,
      codes as unknown as Repository<StoreCheckinCode>,
      repoMock() as unknown as Repository<User>,
      repoMock() as unknown as Repository<Friendship>,
      {
        checkAndAwardByCondition: jest.fn(),
      } as unknown as AchievementsService,
      { server: { emit } } as unknown as NotificationsGateway,
      { sendToUsers: jest.fn() } as unknown as NotificationsService,
    );
  });

  it('recusa código de QR inválido ou desativado', async () => {
    codes.findOne.mockResolvedValue(null);

    await expect(service.checkIn('u1', 'codigo-velho')).rejects.toThrow(
      BadRequestException,
    );
    expect(visits.save).not.toHaveBeenCalled();
  });

  it('check-in repetido devolve a visita aberta sem criar outra', async () => {
    codes.findOne.mockResolvedValue({ id: 'c1' });
    const open = { id: 'aberta', userId: 'u1', checkedOutAt: null };
    visits.findOne.mockResolvedValue(open);

    await expect(service.checkIn('u1', 'codigo-atual')).resolves.toBe(open);
    expect(visits.save).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('primeiro check-in cria a visita e avisa a presença', async () => {
    codes.findOne.mockResolvedValue({ id: 'c1' });
    visits.findOne.mockResolvedValue(null);

    const visit = await service.checkIn('u1', 'codigo-atual');

    expect(visit).toMatchObject({ id: 'v1', userId: 'u1', source: 'QR' });
    expect(emit).toHaveBeenCalledWith('store:presence-changed');
  });
});
