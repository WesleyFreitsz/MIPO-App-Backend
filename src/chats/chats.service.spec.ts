import { ForbiddenException } from '@nestjs/common';
import { FindOperator, Repository } from 'typeorm';
import { Friendship } from 'src/friends/entities/friendship.entity';
import { User } from 'src/users/entities/user.entity';
import { ChatsService } from './chats.service';
import { Chat, ChatType } from './entities/chat.entity';
import { ChatMember } from './entities/chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatMessageReaction } from './entities/chat-message-reaction.entity';

type RepoMock = {
  findOne: jest.Mock;
  find: jest.Mock;
  findAndCount: jest.Mock;
  update: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  exists: jest.Mock;
  remove: jest.Mock;
};

const repoMock = (): RepoMock => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  update: jest.fn(),
  save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  create: jest.fn((entity: unknown) => entity),
  exists: jest.fn(),
  remove: jest.fn(),
});

describe('ChatsService', () => {
  let chatRepository: RepoMock;
  let memberRepository: RepoMock;
  let messageRepository: RepoMock;
  let userRepository: RepoMock;
  let friendshipRepository: RepoMock;
  let reactionRepository: RepoMock;
  let service: ChatsService;

  beforeEach(() => {
    chatRepository = repoMock();
    memberRepository = repoMock();
    messageRepository = repoMock();
    userRepository = repoMock();
    friendshipRepository = repoMock();
    reactionRepository = repoMock();

    service = new ChatsService(
      chatRepository as unknown as Repository<Chat>,
      memberRepository as unknown as Repository<ChatMember>,
      messageRepository as unknown as Repository<ChatMessage>,
      userRepository as unknown as Repository<User>,
      friendshipRepository as unknown as Repository<Friendship>,
      reactionRepository as unknown as Repository<ChatMessageReaction>,
    );
  });

  it('não lista mensagens para quem não é membro', async () => {
    memberRepository.findOne.mockResolvedValue(null);

    await expect(service.getMessages('chat-1', 'intruso')).rejects.toThrow(
      ForbiddenException,
    );
    expect(messageRepository.find).not.toHaveBeenCalled();
  });

  it('esconde o conteúdo de mensagens apagadas', async () => {
    memberRepository.findOne.mockResolvedValue({ chatId: 'chat-1' });
    messageRepository.find.mockResolvedValue([
      {
        id: 'm1',
        content: 'segredo',
        imageUrl: 'https://x/y.png',
        isDeleted: true,
      },
    ]);

    const result = await service.getMessages('chat-1', 'u1');

    expect(result.data[0]).toMatchObject({ content: '', imageUrl: null });
  });

  it('pagina por cursor e informa o próximo cursor', async () => {
    memberRepository.findOne.mockResolvedValue({ chatId: 'chat-1' });
    const createdAt = (minute: number) => new Date(2026, 0, 1, 10, minute);
    messageRepository.find.mockResolvedValue([
      { id: 'm3', createdAt: createdAt(3) },
      { id: 'm2', createdAt: createdAt(2) },
      { id: 'm1', createdAt: createdAt(1) },
    ]);

    const result = await service.getMessages('chat-1', 'u1', undefined, 2);

    expect(result.data.map((m) => m.id)).toEqual(['m3', 'm2']);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('m2');
  });

  it('não deixa editar mensagem de outra pessoa', async () => {
    messageRepository.findOne.mockResolvedValue({
      id: 'm1',
      userId: 'autor',
      isDeleted: false,
    });

    await expect(
      service.editMessage('m1', 'outra-pessoa', 'texto novo'),
    ).rejects.toThrow(ForbiddenException);
    expect(messageRepository.save).not.toHaveBeenCalled();
  });

  it('não deixa apagar mensagem de outra pessoa', async () => {
    messageRepository.findOne.mockResolvedValue({ id: 'm1', userId: 'autor' });

    await expect(service.deleteMessage('m1', 'outra-pessoa')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('apagar limpa o conteúdo da mensagem', async () => {
    messageRepository.findOne
      .mockResolvedValueOnce({ id: 'm1', userId: 'autor' })
      .mockResolvedValueOnce({
        id: 'm1',
        userId: 'autor',
        content: 'oi',
        imageUrl: 'https://x/y.png',
        isDeleted: true,
      });

    const result = await service.deleteMessage('m1', 'autor');

    expect(messageRepository.update).toHaveBeenCalledWith('m1', {
      isDeleted: true,
      content: '',
      imageUrl: null,
    });
    expect(result).toMatchObject({ content: '', imageUrl: null });
  });

  it('marca como lidas só as mensagens dos outros', async () => {
    memberRepository.findOne.mockResolvedValue({ chatId: 'chat-1' });

    await service.markMessagesAsRead('chat-1', 'u1');

    const [criteria] = messageRepository.update.mock.calls[0] as [
      { userId: FindOperator<string> },
    ];
    expect(criteria.userId).toBeInstanceOf(FindOperator);
    expect(criteria.userId.type).toBe('not');
    expect(criteria.userId.value).toBe('u1');
  });

  it('salva a mensagem com o autor autenticado', async () => {
    memberRepository.find.mockResolvedValue([{ userId: 'u1' }]);
    chatRepository.findOne.mockResolvedValue({
      id: 'chat-1',
      type: ChatType.GROUP,
    });
    messageRepository.save.mockResolvedValue({ id: 'm1' });
    messageRepository.findOne.mockResolvedValue({ id: 'm1', chatId: 'chat-1' });

    await service.sendMessage('chat-1', 'u1', { content: 'oi' });

    expect(messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'chat-1',
        userId: 'u1',
        content: 'oi',
        imageUrl: null,
      }),
    );
  });

  it('não envia mensagem de quem não é membro', async () => {
    memberRepository.find.mockResolvedValue([{ userId: 'u2' }]);
    chatRepository.findOne.mockResolvedValue({
      id: 'chat-1',
      type: ChatType.GROUP,
    });

    await expect(
      service.sendMessage('chat-1', 'intruso', { content: 'oi' }),
    ).rejects.toThrow(ForbiddenException);
    expect(messageRepository.save).not.toHaveBeenCalled();
  });

  it('bloqueia mensagem em chat privado com usuário bloqueado', async () => {
    memberRepository.find.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
    chatRepository.findOne.mockResolvedValue({
      id: 'chat-1',
      type: ChatType.PRIVATE,
    });
    friendshipRepository.exists.mockResolvedValue(true);

    await expect(
      service.sendMessage('chat-1', 'u1', { content: 'oi' }),
    ).rejects.toThrow(ForbiddenException);
    expect(messageRepository.save).not.toHaveBeenCalled();
  });
});
