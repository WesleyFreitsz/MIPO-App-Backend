import { BadRequestException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { NotificationsService } from 'src/notifications/notifications.service';
import { User } from 'src/users/entities/user.entity';
import { Reward } from './entities/reward.entity';
import { RewardRedemption } from './entities/reward-redemption.entity';
import { RewardsService } from './rewards.service';

jest.mock('src/notifications/notifications.service', () => ({
  NotificationsService: class {},
}));

describe('RewardsService.redeem', () => {
  const reward = { id: 'r1', title: 'Refri', price: 50, stock: 3 } as Reward;
  let manager: {
    findOne: jest.Mock;
    decrement: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let notifications: { notifyAdmins: jest.Mock };
  let service: RewardsService;

  beforeEach(() => {
    manager = {
      findOne: jest.fn().mockResolvedValue(reward),
      decrement: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((_entity: unknown, data: object) => data),
      save: jest.fn((data: object) => Promise.resolve({ id: 'rd1', ...data })),
    };
    notifications = { notifyAdmins: jest.fn() };
    const rewardsRepository = {
      manager: {
        transaction: (work: (m: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
      },
    };
    service = new RewardsService(
      rewardsRepository as unknown as Repository<Reward>,
      {} as Repository<RewardRedemption>,
      notifications as unknown as NotificationsService,
    );
  });

  it('debita o preço do saldo, baixa o estoque e registra o resgate', async () => {
    const result = await service.redeem('u1', 'r1');

    expect(manager.decrement).toHaveBeenCalledWith(
      Reward,
      expect.objectContaining({ id: 'r1' }),
      'stock',
      1,
    );
    expect(manager.decrement).toHaveBeenCalledWith(
      User,
      expect.objectContaining({ id: 'u1' }),
      'coins',
      50,
    );
    expect(result).toMatchObject({ userId: 'u1', rewardTitle: 'Refri' });
    expect(notifications.notifyAdmins).toHaveBeenCalled();
  });

  it('recusa quando o saldo não cobre o preço e não grava o resgate', async () => {
    manager.decrement
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 0 });

    await expect(service.redeem('u1', 'r1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.save).not.toHaveBeenCalled();
    expect(notifications.notifyAdmins).not.toHaveBeenCalled();
  });

  it('recusa recompensa esgotada sem mexer no saldo', async () => {
    manager.decrement.mockResolvedValueOnce({ affected: 0 });

    await expect(service.redeem('u1', 'r1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.decrement).toHaveBeenCalledTimes(1);
  });
});
