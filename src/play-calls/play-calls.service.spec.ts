import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PlayCallsService } from './play-calls.service';
import { PlayCallMode, PlayCallStatus } from './entities/play-call.entity';
import { FriendshipStatus } from 'src/friends/entities/friendship.entity';

const repo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
  save: jest.fn((v: unknown) => Promise.resolve(v)),
  create: jest.fn((v: unknown) => v),
  update: jest.fn(),
  delete: jest.fn(),
});

function build() {
  const calls = repo();
  const members = repo();
  const friendships = repo();
  const storeVisits = {
    hasOpenVisit: jest.fn().mockResolvedValue({ id: 'v' }),
  };
  const service = new PlayCallsService(
    calls as never,
    members as never,
    repo() as never,
    repo() as never,
    friendships as never,
    repo() as never,
    storeVisits as never,
    {} as never,
    { sendToUser: jest.fn() } as never,
    { server: { emit: jest.fn() } } as never,
  );
  return { service, calls, members, friendships, storeVisits };
}

const openCall = {
  id: 'c1',
  creatorId: 'criador',
  title: 'Catan',
  mode: PlayCallMode.NOW,
  status: PlayCallStatus.OPEN,
  slotsNeeded: 2,
  chatId: null,
  members: [],
  creator: { id: 'criador', name: 'C', nickname: null, avatarUrl: null },
  game: null,
};

describe('PlayCallsService', () => {
  it('limita a 2 chamados abertos por criador', async () => {
    const { service, calls } = build();
    calls.count.mockResolvedValue(2);
    await expect(
      service.create('u1', {
        mode: PlayCallMode.SCHEDULED,
        title: 'Jogatina',
        scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
        slotsNeeded: 3,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(calls.save).not.toHaveBeenCalled();
  });

  it('chamado de agora exige check-in', async () => {
    const { service, storeVisits } = build();
    storeVisits.hasOpenVisit.mockResolvedValue(null);
    await expect(
      service.create('u1', {
        mode: PlayCallMode.NOW,
        title: 'X',
        slotsNeeded: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('bloqueio com o criador impede entrar', async () => {
    const { service, calls, friendships, members } = build();
    calls.findOne.mockResolvedValue(openCall);
    friendships.find.mockResolvedValue([
      { userId: 'criador', friendId: 'u1', status: FriendshipStatus.BLOCKED },
    ]);
    await expect(service.join('u1', 'c1')).rejects.toThrow(ForbiddenException);
    expect(members.save).not.toHaveBeenCalled();
  });

  it('não deixa entrar em chamado lotado', async () => {
    const { service, calls } = build();
    calls.findOne.mockResolvedValue({
      ...openCall,
      status: PlayCallStatus.FULL,
    });
    await expect(service.join('u1', 'c1')).rejects.toThrow(BadRequestException);
  });

  it('chamado de agora some da lista para quem não está na loja', async () => {
    const { service, calls, storeVisits } = build();
    storeVisits.hasOpenVisit.mockResolvedValue(null);
    await expect(service.list('u1', PlayCallMode.NOW)).resolves.toEqual([]);
    expect(calls.find).not.toHaveBeenCalled();
  });
});
