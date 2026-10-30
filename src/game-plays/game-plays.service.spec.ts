import { Repository } from 'typeorm';
import { GamePlaysService } from './game-plays.service';
import { GamePlay } from './entities/game-play.entity';
import { Game } from 'src/games/entities/game.entity';
import { GameUserMark } from 'src/games/entities/game-user-mark.entity';
import { Friendship } from 'src/friends/entities/friendship.entity';
import { User } from 'src/users/entities/user.entity';
import { NotificationsService } from 'src/notifications/notifications.service';

describe('GamePlaysService', () => {
  const insertChain = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };
  const playRepository = {
    createQueryBuilder: jest.fn(() => insertChain),
  };
  const friendshipRepository = { find: jest.fn() };
  const gameRepository = { findOne: jest.fn() };

  const service = new GamePlaysService(
    playRepository as unknown as Repository<GamePlay>,
    gameRepository as unknown as Repository<Game>,
    {} as Repository<GameUserMark>,
    friendshipRepository as unknown as Repository<Friendship>,
    {} as Repository<User>,
    {} as NotificationsService,
  );

  it('registra partida de pedido ignorando o mesmo item repetido', async () => {
    const play = {
      orderItemId: 'item-1',
      gameId: 'g1',
      userId: 'u1',
      playedAt: new Date(),
    };
    await service.recordFromOrderItem(play);
    await service.recordFromOrderItem(play);

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ orderItemId: 'item-1', source: 'ORDER' }),
    );
    expect(insertChain.orIgnore).toHaveBeenCalledTimes(2);
  });

  it('não deixa marcar quem não é amigo', async () => {
    gameRepository.findOne.mockResolvedValue({ id: 'g1', name: 'Azul' });
    friendshipRepository.find.mockResolvedValue([
      { userId: 'u1', friendId: 'amigo' },
    ]);

    await expect(
      service.recordManual('u1', 'g1', { playerIds: ['amigo', 'estranho'] }),
    ).rejects.toThrow('Você só pode marcar amigos que jogaram com você.');
  });
});
