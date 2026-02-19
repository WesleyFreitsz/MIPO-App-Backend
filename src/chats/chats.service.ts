import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat, ChatType } from './entities/chat.entity';
import { ChatMember, ChatMemberRole } from './entities/chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AddMembersDto } from './dto/add-members.dto';

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
  ) {}

  /**
   * Criar um novo chat (grupo ou privado)
   */
  async createChat(
    userId: string,
    dto: CreateChatDto,
    type: ChatType = ChatType.GROUP,
  ) {
    const chat = this.chatRepository.create({
      ...dto,
      type,
      createdByUserId: userId,
    });

    const savedChat = await this.chatRepository.save(chat);

    // Adiciona o criador como membro admin
    const member = this.memberRepository.create({
      chatId: savedChat.id,
      userId,
      role: ChatMemberRole.ADMIN,
    });

    await this.memberRepository.save(member);

    return this.getChatDetails(savedChat.id);
  }

  /**
   * Obter detalhes de um chat
   */
  async getChatDetails(chatId: string) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members', 'members.user', 'messages', 'messages.user'],
    });

    if (!chat) {
      throw new NotFoundException('Chat não encontrado');
    }

    return chat;
  }

  /**
   * Listar todos os chats do usuário
   */
  async getUserChats(userId: string, skip = 0, take = 20) {
    const [chats, total] = await this.chatRepository
      .createQueryBuilder('chat')
      .innerJoinAndSelect('chat.members', 'member', 'member.userId = :userId', {
        userId,
      })
      .leftJoinAndSelect('chat.messages', 'message')
      .leftJoinAndSelect('message.user', 'messageUser')
      .leftJoinAndSelect('chat.members', 'allMembers')
      .leftJoinAndSelect('allMembers.user', 'memberUser')
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('chat.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    // Adiciona informação da última mensagem e contador de não lidos
    const chatsWithDetails = chats.map((chat) => {
      const lastMessage = chat.messages?.[0];
      const userMember = chat.members?.find((m) => m.userId === userId);
      const unreadCount =
        chat.messages?.filter((m) => !m.isRead && m.userId !== userId).length ||
        0;

      return {
        ...chat,
        lastMessage,
        unreadCount,
      };
    });

    return { data: chatsWithDetails, total, skip, take };
  }

  /**
   * Adicionar membros a um chat
   */
  async addMembers(chatId: string, userId: string, dto: AddMembersDto) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members'],
    });

    if (!chat) {
      throw new NotFoundException('Chat não encontrado');
    }

    // Verifica se o usuário é admin do chat
    const userMember = chat.members?.find((m) => m.userId === userId);
    if (!userMember || userMember.role !== ChatMemberRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para adicionar membros',
      );
    }

    // Adiciona novos membros
    const newMembers = dto.memberIds.map((memberId) =>
      this.memberRepository.create({
        chatId,
        userId: memberId,
        role: ChatMemberRole.MEMBER,
      }),
    );

    await this.memberRepository.save(newMembers);

    return this.getChatDetails(chatId);
  }

  /**
   * Remover membro do chat
   */
  async removeMember(chatId: string, userId: string, memberId: string) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members'],
    });

    if (!chat) {
      throw new NotFoundException('Chat não encontrado');
    }

    // Verifica se o usuário é admin
    const userMember = chat.members?.find((m) => m.userId === userId);
    if (!userMember || userMember.role !== ChatMemberRole.ADMIN) {
      throw new ForbiddenException(
        'Você não tem permissão para remover membros',
      );
    }

    // Remove o membro
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
   * Enviar mensagem
   */
  async sendMessage(chatId: string, userId: string, dto: SendMessageDto) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members'],
    });

    if (!chat) {
      throw new NotFoundException('Chat não encontrado');
    }

    // Verifica se o usuário é membro
    const isMember = chat.members?.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Você não é membro deste chat');
    }

    const message = this.messageRepository.create({
      chatId,
      userId,
      ...dto,
    });

    return this.messageRepository.save(message);
  }

  /**
   * Listar mensagens de um chat
   */
  async getMessages(chatId: string, skip = 0, take = 50) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
    });

    if (!chat) {
      throw new NotFoundException('Chat não encontrado');
    }

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { chatId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      skip,
      take,
    });

    return { data: messages, total, skip, take };
  }

  /**
   * Marcar mensagens como lidas
   */
  async markMessagesAsRead(chatId: string, userId: string) {
    await this.messageRepository.update(
      { chatId, isRead: false },
      { isRead: true },
    );

    // Atualiza lastReadAt do membro
    await this.memberRepository.update(
      { chatId, userId },
      { lastReadAt: new Date() },
    );

    return { message: 'Mensagens marcadas como lidas' };
  }

  /**
   * Criar chat privado entre dois usuários
   */
  async createPrivateChat(userId: string, targetUserId: string) {
    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verifica se já existe um chat privado
    const existingChat = await this.chatRepository
      .createQueryBuilder('chat')
      .where('chat.type = :type', { type: ChatType.PRIVATE })
      .innerJoinAndSelect(
        'chat.members',
        'member1',
        'member1.userId = :userId',
        { userId },
      )
      .innerJoinAndSelect(
        'chat.members',
        'member2',
        'member2.userId = :targetUserId',
        { targetUserId },
      )
      .getOne();

    if (existingChat) {
      return this.getChatDetails(existingChat.id);
    }

    // Cria novo chat privado
    const chat = this.chatRepository.create({
      type: ChatType.PRIVATE,
      name: user.nickname || user.name,
      createdByUserId: userId,
    });

    const savedChat = await this.chatRepository.save(chat);

    // Adiciona membros
    const members = [
      { chatId: savedChat.id, userId, role: ChatMemberRole.ADMIN },
      {
        chatId: savedChat.id,
        userId: targetUserId,
        role: ChatMemberRole.MEMBER,
      },
    ];

    await this.memberRepository.save(members);

    return this.getChatDetails(savedChat.id);
  }

  /**
   * Deletar chat
   */
  async deleteChat(chatId: string, userId: string) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members'],
    });

    if (!chat) {
      throw new NotFoundException('Chat não encontrado');
    }

    // Verifica se o usuário é o criador
    if (chat.createdByUserId !== userId) {
      throw new ForbiddenException('Apenas o criador do chat pode deletá-lo');
    }

    await this.chatRepository.remove(chat);
    return { message: 'Chat deletado com sucesso' };
  }

  /**
   * Sair de um chat
   */
  async leaveChat(chatId: string, userId: string) {
    const member = await this.memberRepository.findOne({
      where: { chatId, userId },
    });

    if (!member) {
      throw new NotFoundException('Você não é membro deste chat');
    }

    await this.memberRepository.remove(member);
    return { message: 'Você saiu do chat com sucesso' };
  }
}
