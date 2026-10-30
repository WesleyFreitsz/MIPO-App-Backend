import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Raw, Repository } from 'typeorm';
import { Chat, ChatType } from './entities/chat.entity';
import { ChatMember, ChatMemberRole } from './entities/chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatMessageReaction } from './entities/chat-message-reaction.entity';
import { isUniqueViolation } from 'src/common/database-errors';
import { User } from '../users/entities/user.entity';
import {
  Friendship,
  FriendshipStatus,
} from '../friends/entities/friendship.entity';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AddMembersDto } from './dto/add-members.dto';

import { assertAllowedContent } from 'src/common/content-filter';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(ChatMember)
    private memberRepository: Repository<ChatMember>,
    @InjectRepository(ChatMessage)
    private messageRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Friendship)
    private friendshipRepository: Repository<Friendship>,
    @InjectRepository(ChatMessageReaction)
    private reactionRepository: Repository<ChatMessageReaction>,
  ) {}

  async assertMember(chatId: string, userId: string) {
    const member = await this.memberRepository.findOne({
      where: { chatId, userId },
    });
    if (!member) {
      throw new ForbiddenException('Você não é membro deste chat');
    }
    return member;
  }

  async isMember(chatId: string, userId: string) {
    return this.memberRepository.exists({ where: { chatId, userId } });
  }

  async getMemberIds(chatId: string) {
    const members = await this.memberRepository.find({
      where: { chatId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  async canWatchPresence(viewerId: string, targetId: string) {
    const sharedPrivateChat = await this.memberRepository
      .createQueryBuilder('viewer')
      .innerJoin(
        ChatMember,
        'target',
        'target.chatId = viewer.chatId AND target.userId = :targetId',
        { targetId },
      )
      .innerJoin('viewer.chat', 'chat', 'chat.type = :type', {
        type: ChatType.PRIVATE,
      })
      .where('viewer.userId = :viewerId', { viewerId })
      .getExists();
    if (!sharedPrivateChat) return false;
    const target = await this.userRepository.findOne({
      where: { id: targetId },
      select: { id: true, showLastSeen: true },
    });
    return (
      !!target?.showLastSeen &&
      !(await this.isBlockedBetween(viewerId, [targetId]))
    );
  }

  private async isBlockedBetween(userId: string, otherUserIds: string[]) {
    if (otherUserIds.length === 0) return false;
    return this.friendshipRepository.exists({
      where: [
        {
          userId,
          friendId: In(otherUserIds),
          status: FriendshipStatus.BLOCKED,
        },
        {
          userId: In(otherUserIds),
          friendId: userId,
          status: FriendshipStatus.BLOCKED,
        },
      ],
    });
  }

  async loadMessage(messageId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['user', 'replyTo', 'replyTo.user', 'reactions'],
    });
    if (!message) throw new NotFoundException('Mensagem não encontrada');
    return this.hideDeletedContent(message);
  }

  private hideDeletedContent(message: ChatMessage): ChatMessage {
    const replyTo = message.replyTo?.isDeleted
      ? { ...message.replyTo, content: '', imageUrl: null }
      : message.replyTo;
    return message.isDeleted
      ? { ...message, content: '', imageUrl: null, replyTo }
      : { ...message, replyTo };
  }

  /**
   * Criar um novo chat (grupo ou privado)
   */
  async createChat(
    userId: string,
    dto: CreateChatDto,
    type: ChatType = ChatType.GROUP,
  ) {
    assertAllowedContent(dto.name, dto.description);
    const chat = this.chatRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl ?? null,
      type,
      createdByUserId: userId,
    });

    const savedChat = await this.chatRepository.save(chat);

    // Adiciona o criador como membro admin do grupo
    const member = this.memberRepository.create({
      chatId: savedChat.id,
      userId,
      role: ChatMemberRole.ADMIN,
    });

    await this.memberRepository.save(member);

    return this.getChatDetails(savedChat.id);
  }

  async getChatDetailsForMember(chatId: string, userId: string) {
    await this.assertMember(chatId, userId);
    return this.getChatDetails(chatId);
  }

  /**
   * Obter detalhes de um chat
   */
  async getChatDetails(chatId: string) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members', 'members.user'],
    });

    if (!chat) {
      throw new NotFoundException('Chat não encontrado');
    }

    return chat;
  }

  /**
   * Listar todos os chats do usuário com paginação otimizada (10 por vez)
   */
  async getUserChats(userId: string, skip = 0, take = 10) {
    const [chats, total] = await this.chatRepository
      .createQueryBuilder('chat')
      // 1. Filtra para trazer apenas os chats onde o usuário logado está
      .innerJoin(
        'chat.members',
        'filterMember',
        'filterMember.userId = :userId',
        {
          userId,
        },
      )
      // 2. CORREÇÃO: Carrega a lista completa de membros do chat
      .leftJoinAndSelect('chat.members', 'member')
      // 3. CORREÇÃO: Carrega os dados de usuário (nome, foto) de cada membro
      .leftJoinAndSelect('member.user', 'user')
      // 4. Carrega a última mensagem
      .leftJoinAndSelect('chat.lastMessage', 'lastMessage')
      .leftJoinAndSelect('lastMessage.user', 'messageUser')
      .orderBy('chat.updatedAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    const unreadByChat = await this.countUnreadByChat(
      chats.map((chat) => chat.id),
      userId,
    );

    const chatsWithDetails = chats.map((chat) => {
      return {
        ...chat,
        lastMessage: chat.lastMessage
          ? this.hideDeletedContent(chat.lastMessage)
          : chat.lastMessage,
        unreadCount: unreadByChat.get(chat.id) ?? 0,
      };
    });

    return {
      data: chatsWithDetails,
      total,
      skip,
      take,
      hasMore: total > skip + take,
    };
  }
  private async countUnreadByChat(chatIds: string[], userId: string) {
    if (chatIds.length === 0) return new Map<string, number>();
    const rows = await this.messageRepository
      .createQueryBuilder('m')
      .select('m.chatId', 'chatId')
      .addSelect('COUNT(*)', 'count')
      .innerJoin(
        ChatMember,
        'cm',
        'cm.chatId = m.chatId AND cm.userId = :userId',
        { userId },
      )
      .where('m.chatId IN (:...chatIds)', { chatIds })
      .andWhere('m.userId != :userId', { userId })
      .andWhere('m.isDeleted = false')
      .andWhere('(cm.lastReadAt IS NULL OR m.createdAt > cm.lastReadAt)')
      .groupBy('m.chatId')
      .getRawMany<{ chatId: string; count: string }>();
    return new Map(rows.map((row) => [row.chatId, Number(row.count)]));
  }

  /**
   * Adicionar membros a um chat (Apenas Admin do Grupo)
   */
  async addMembers(chatId: string, userId: string, dto: AddMembersDto) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members'],
    });

    if (!chat) {
      throw new NotFoundException('Chat não encontrado');
    }

    const userMember = chat.members?.find((m) => m.userId === userId);
    if (!userMember || userMember.role !== ChatMemberRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para adicionar membros',
      );
    }

    // Filtra amigos que já estão no chat para não dar conflito
    const existingMemberIds = chat.members.map((m) => m.userId);
    const newMembersIds = dto.memberIds.filter(
      (id) => !existingMemberIds.includes(id),
    );

    const existingUsers =
      newMembersIds.length > 0
        ? await this.userRepository.find({
            where: { id: In(newMembersIds), banned: false },
            select: { id: true },
          })
        : [];
    const validMemberIds = existingUsers.map((u) => u.id);

    if (validMemberIds.length > 0) {
      const newMembers = validMemberIds.map((memberId) =>
        this.memberRepository.create({
          chatId,
          userId: memberId,
          role: ChatMemberRole.MEMBER,
        }),
      );
      await this.memberRepository.save(newMembers);
    }

    return this.getChatDetails(chatId);
  }

  /**
   * Promover um membro a Admin do Grupo
   */
  async promoteToAdmin(chatId: string, adminId: string, targetUserId: string) {
    const requester = await this.memberRepository.findOne({
      where: { chatId, userId: adminId },
    });

    if (!requester || requester.role !== ChatMemberRole.ADMIN) {
      throw new ForbiddenException(
        'Apenas admins do grupo podem promover outros membros',
      );
    }

    const targetMember = await this.memberRepository.findOne({
      where: { chatId, userId: targetUserId },
    });

    if (!targetMember) {
      throw new NotFoundException('Membro não encontrado no chat');
    }

    await this.memberRepository.update(
      { chatId, userId: targetUserId },
      { role: ChatMemberRole.ADMIN },
    );

    return { message: 'Membro promovido a admin com sucesso' };
  }

  /**
   * Remover membro do chat (Apenas Admin do Grupo)
   */
  async removeMember(chatId: string, userId: string, memberId: string) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members'],
    });

    if (!chat) {
      throw new NotFoundException('Chat não encontrado');
    }

    const userMember = chat.members?.find((m) => m.userId === userId);
    if (!userMember || userMember.role !== ChatMemberRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para remover membros',
      );
    }

    const member = await this.memberRepository.findOne({
      where: { chatId, userId: memberId },
    });

    if (!member) {
      throw new NotFoundException('Membro não encontrado');
    }

    await this.memberRepository.remove(member);

    return { message: 'Membro removido com sucesso' };
  }

  /**
   * Enviar mensagem e atualizar a última mensagem no Chat
   */
  async sendMessage(chatId: string, userId: string, dto: SendMessageDto) {
    assertAllowedContent(dto.content);
    if (!dto.content.trim() && !dto.imageUrl) {
      throw new BadRequestException('A mensagem precisa de texto ou imagem.');
    }
    const [chat, members, replyTo] = await Promise.all([
      this.chatRepository.findOne({
        where: { id: chatId },
        select: { id: true, type: true, name: true },
      }),
      this.memberRepository.find({
        where: { chatId },
        select: { userId: true },
      }),
      dto.replyToId
        ? this.messageRepository.findOne({
            where: { id: dto.replyToId, chatId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!chat) throw new NotFoundException('Chat não encontrado');

    const memberIds = members.map((m) => m.userId);
    if (!memberIds.includes(userId)) {
      throw new ForbiddenException('Você não é membro deste chat');
    }
    if (dto.replyToId && !replyTo) {
      throw new BadRequestException('Mensagem respondida não encontrada');
    }

    if (
      chat.type === ChatType.PRIVATE &&
      (await this.isBlockedBetween(
        userId,
        memberIds.filter((id) => id !== userId),
      ))
    ) {
      throw new ForbiddenException(
        'Não é possível enviar mensagens para este usuário.',
      );
    }

    const alreadySaved = await this.findByClientId(userId, dto.clientId);
    if (alreadySaved) {
      const message = await this.loadMessage(alreadySaved.id);
      return { message, memberIds, chat, duplicate: true };
    }

    let savedMessage: ChatMessage;
    try {
      savedMessage = await this.messageRepository.save(
        this.messageRepository.create({
          chatId,
          userId,
          content: dto.content,
          imageUrl: dto.imageUrl ?? null,
          replyToId: dto.replyToId ?? null,
          clientId: dto.clientId ?? null,
        }),
      );
    } catch (error) {
      const raced = isUniqueViolation(error)
        ? await this.findByClientId(userId, dto.clientId)
        : null;
      if (!raced) throw error;
      const message = await this.loadMessage(raced.id);
      return { message, memberIds, chat, duplicate: true };
    }

    const [, message] = await Promise.all([
      this.chatRepository.update(chatId, {
        lastMessageId: savedMessage.id,
        updatedAt: new Date(),
      }),
      this.loadMessage(savedMessage.id),
    ]);

    return { message, memberIds, chat, duplicate: false };
  }

  private findByClientId(userId: string, clientId?: string) {
    if (!clientId) return Promise.resolve(null);
    return this.messageRepository.findOne({
      where: { userId, clientId },
      select: { id: true },
    });
  }

  /**
   * Listar mensagens de um chat, mais recentes primeiro, paginando por cursor
   */
  async getMessages(
    chatId: string,
    userId: string,
    before?: string,
    take = 30,
  ) {
    await this.assertMember(chatId, userId);

    const messages = await this.messageRepository.find({
      where: before
        ? {
            chatId,
            // Compara (createdAt, id) com a mensagem do cursor no próprio banco, sem perder os microssegundos.
            id: Raw(
              (idColumn) =>
                `(${idColumn.replace(/id$/, 'createdAt')}, ${idColumn}) < (SELECT c."createdAt", c.id FROM chat_messages c WHERE c.id = :before)`,
              { before },
            ),
          }
        : { chatId },
      relations: ['user', 'replyTo', 'replyTo.user', 'reactions'],
      order: { createdAt: 'DESC', id: 'DESC' },
      take: take + 1,
    });

    const hasMore = messages.length > take;
    const page = messages
      .slice(0, take)
      .map((message) => this.hideDeletedContent(message));

    return {
      data: page,
      hasMore,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /**
   * Marcar mensagens como lidas
   */
  async markMessagesAsRead(chatId: string, userId: string) {
    await this.assertMember(chatId, userId);

    await this.messageRepository.update(
      { chatId, isRead: false, userId: Not(userId) },
      { isRead: true },
    );

    await this.memberRepository.update(
      { chatId, userId },
      { lastReadAt: new Date() },
    );

    return { message: 'Mensagens marcadas como lidas' };
  }

  /**
   * Criar chat privado entre dois usuários de forma otimizada
   */
  async createPrivateChat(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException(
        'Não é possível iniciar uma conversa consigo mesmo.',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!user || user.banned) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (await this.isBlockedBetween(userId, [targetUserId])) {
      throw new ForbiddenException(
        'Não é possível iniciar uma conversa com este usuário.',
      );
    }

    const existingChat = await this.chatRepository
      .createQueryBuilder('chat')
      .where('chat.type = :type', { type: ChatType.PRIVATE })
      .innerJoin('chat.members', 'member1', 'member1.userId = :userId', {
        userId,
      })
      .innerJoin('chat.members', 'member2', 'member2.userId = :targetUserId', {
        targetUserId,
      })
      .getOne();

    if (existingChat) {
      return this.getChatDetails(existingChat.id);
    }

    const chat = this.chatRepository.create({
      type: ChatType.PRIVATE,
      name: user.nickname || user.name,
      createdByUserId: userId,
    });

    const savedChat = await this.chatRepository.save(chat);

    const members = [
      this.memberRepository.create({
        chatId: savedChat.id,
        userId,
        role: ChatMemberRole.ADMIN,
      }),
      this.memberRepository.create({
        chatId: savedChat.id,
        userId: targetUserId,
        role: ChatMemberRole.MEMBER,
      }),
    ];

    await this.memberRepository.save(members);

    return this.getChatDetails(savedChat.id);
  }

  /**
   * Deletar chat (Apenas Criador)
   */
  async deleteChat(chatId: string, userId: string) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
    });

    if (!chat) {
      throw new NotFoundException('Chat não encontrado');
    }

    if (chat.createdByUserId !== userId) {
      throw new ForbiddenException('Apenas o criador do chat pode deletá-lo');
    }

    await this.chatRepository.remove(chat);
    return { message: 'Chat deletado com sucesso' };
  }

  /**
   * Atualizar detalhes do chat
   */
  async updateChatDetails(chatId: string, userId: string, data: UpdateChatDto) {
    assertAllowedContent(data.name, data.description);
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members'],
    });

    if (!chat) throw new NotFoundException('Chat não encontrado');

    const userMember = chat.members?.find((m) => m.userId === userId);
    if (!userMember || userMember.role !== ChatMemberRole.ADMIN) {
      throw new ForbiddenException('Apenas admins podem editar o grupo');
    }

    if (data.name !== undefined) chat.name = data.name;
    if (data.description !== undefined) chat.description = data.description;
    if (data.imageUrl !== undefined) chat.imageUrl = data.imageUrl;

    await this.chatRepository.save(chat);
    return this.getChatDetails(chatId);
  }

  /**
   * Sair de um chat (Com as lógicas adicionais implementadas)
   */
  async leaveChat(chatId: string, userId: string) {
    // 1. Encontra o membro atual que quer sair
    const member = await this.memberRepository.findOne({
      where: { chatId, userId },
    });

    if (!member) {
      throw new NotFoundException('Você não é membro deste chat');
    }

    // Salva a informação se quem está saindo era um ADMIN
    const wasAdmin = member.role === ChatMemberRole.ADMIN;

    // 2. Remove o membro do chat
    await this.memberRepository.remove(member);

    // 3. Busca quem sobrou no chat ordenando do mais antigo para o mais novo
    const remainingMembers = await this.memberRepository.find({
      where: { chatId },
      order: { joinedAt: 'ASC' }, // ASC garante que [0] é o que entrou primeiro (mais antigo)
    });

    // 4. Se a lista estiver vazia, apaga o chat totalmente do banco
    if (remainingMembers.length === 0) {
      const chat = await this.chatRepository.findOne({ where: { id: chatId } });
      if (chat) {
        await this.chatRepository.remove(chat);
      }
      return {
        message:
          'Você saiu do chat. O grupo foi apagado pois não havia mais ninguém.',
      };
    }

    if (wasAdmin) {
      const hasAdminLeft = remainingMembers.some(
        (m) => m.role === ChatMemberRole.ADMIN,
      );

      if (!hasAdminLeft) {
        const oldestMember = remainingMembers[0];
        oldestMember.role = ChatMemberRole.ADMIN;
        await this.memberRepository.save(oldestMember);
      }
    }

    return { message: 'Você saiu do chat com sucesso' };
  }

  /**
   * Atualizar cargo de um membro (Tornar Admin ou despromover)
   */

  /**
   * Editar mensagem
   */
  async editMessage(messageId: string, userId: string, newText: string) {
    assertAllowedContent(newText);
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Mensagem não encontrada');
    if (message.userId !== userId) {
      throw new ForbiddenException('Você só pode editar suas mensagens');
    }
    if (message.isDeleted) {
      throw new BadRequestException('Mensagem apagada não pode ser editada');
    }

    await this.messageRepository.update(messageId, {
      content: newText,
      isEdited: true,
    });
    return this.loadMessage(messageId);
  }

  /**
   * Apagar mensagem
   */
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Mensagem não encontrada');
    if (message.userId !== userId) {
      throw new ForbiddenException('Você só pode apagar suas mensagens');
    }

    await this.messageRepository.update(messageId, {
      isDeleted: true,
      content: '',
      imageUrl: null,
    });
    return this.loadMessage(messageId);
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      select: { id: true, chatId: true, isDeleted: true },
    });
    if (!message) throw new NotFoundException('Mensagem não encontrada');
    await this.assertMember(message.chatId, userId);
    if (message.isDeleted) {
      throw new BadRequestException('Mensagem apagada não aceita reações');
    }

    const existing = await this.reactionRepository.findOne({
      where: { messageId, userId, emoji },
    });
    if (existing) {
      await this.reactionRepository.delete({ messageId, userId, emoji });
    } else {
      await this.reactionRepository
        .createQueryBuilder()
        .insert()
        .values({ messageId, userId, emoji })
        .orIgnore()
        .execute();
    }

    return this.loadMessage(messageId);
  }

  async touchLastSeen(userId: string) {
    const lastSeenAt = new Date();
    await this.memberRepository.update({ userId }, { lastSeenAt });
    return lastSeenAt;
  }

  async getLastSeen(userId: string) {
    const member = await this.memberRepository.findOne({
      where: { userId },
      select: { lastSeenAt: true },
      order: { lastSeenAt: { direction: 'DESC', nulls: 'LAST' } },
    });
    return member?.lastSeenAt ?? null;
  }

  async getPushRecipients(userIds: string[]) {
    if (userIds.length === 0) return [];
    return this.userRepository.find({
      where: { id: In(userIds) },
      select: { id: true, notificationToken: true },
    });
  }

  /**
   * Definir cor customizada do usuário no chat (Grupos/Eventos)
   */
  async updateMemberColor(chatId: string, userId: string, color: string) {
    const member = await this.memberRepository.findOne({
      where: { chatId, userId },
    });
    if (!member) throw new NotFoundException('Você não é membro deste chat');

    member.customColor = color;
    await this.memberRepository.save(member);
    return member;
  }

  /**
   * Atualizar o Tema do Chat (Cor dos balões)
   */
  async updateMemberBackground(
    chatId: string,
    userId: string,
    themeColor: string,
  ) {
    const member = await this.memberRepository.findOne({
      where: { chatId, userId },
    });

    if (!member) throw new NotFoundException('Você não é membro deste chat');

    member.backgroundTheme = themeColor;
    await this.memberRepository.save(member);

    return member;
  }
}
