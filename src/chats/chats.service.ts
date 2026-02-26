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

    // Adiciona o criador como membro admin do grupo
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
      .innerJoin('chat.members', 'member', 'member.userId = :userId', {
        userId,
      })
      .leftJoinAndSelect('chat.lastMessage', 'lastMessage')
      .leftJoinAndSelect('lastMessage.user', 'messageUser')
      .orderBy('chat.updatedAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    // Mapeamos para garantir que o formato do frontend não quebre
    const chatsWithDetails = chats.map((chat) => {
      return {
        ...chat,
        // O unreadCount é mantido em 0 na listagem principal para não pesar a query.
        // O frontend usa a lógica de bolinha verificando lastReadAt vs lastMessage.createdAt
        unreadCount: 0,
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

    if (newMembersIds.length > 0) {
      const newMembers = newMembersIds.map((memberId) =>
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
   * Enviar mensagem e atualizar a última mensagem no Chat (Performance Maximizada)
   */
  async sendMessage(chatId: string, userId: string, dto: SendMessageDto) {
    // Valida diretamente no banco para poupar memória (evita carregar arrays gigantes)
    const isMember = await this.memberRepository.findOne({
      where: { chatId, userId },
    });

    if (!isMember) {
      throw new ForbiddenException('Você não é membro deste chat');
    }

    const message = this.messageRepository.create({
      chatId,
      userId,
      ...dto,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Atualiza o chat apontando para essa nova mensagem (elimina a subquery de listagem)
    await this.chatRepository.update(chatId, {
      lastMessageId: savedMessage.id,
      updatedAt: new Date(),
    });

    return savedMessage;
  }

  /**
   * Listar mensagens de um chat com paginação (15 por vez)
   */
  async getMessages(chatId: string, skip = 0, take = 15) {
    const [messages, total] = await this.messageRepository.findAndCount({
      where: { chatId },
      relations: ['user'], // Carrega só o usuário dono da mensagem
      order: { createdAt: 'DESC' }, // Mais recentes primeiro para a query ser rápida
      skip,
      take,
    });

    return {
      data: messages.reverse(), // Reverte no backend para a tela fluir do jeito correto
      total,
      skip,
      take,
      hasMore: total > skip + take,
    };
  }

  /**
   * Marcar mensagens como lidas
   */
  async markMessagesAsRead(chatId: string, userId: string) {
    await this.messageRepository.update(
      { chatId, isRead: false },
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
    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
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
  async updateChatDetails(
    chatId: string,
    userId: string,
    data: { name?: string; description?: string; imageUrl?: string },
  ) {
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
}
