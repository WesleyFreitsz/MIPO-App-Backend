import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Namespace, Socket } from 'socket.io';
import { ChatsService } from './chats.service';
import { SocketAuthService } from 'src/auth/socket-auth.service';
import {
  ChatRoomDto,
  SocketDeleteMessageDto,
  SocketEditMessageDto,
  SocketSendMessageDto,
} from './dto/chat-socket.dto';

interface ChatSocketData {
  userId?: string;
}

function socketUserId(client: Socket): string | undefined {
  const data = client.data as ChatSocketData | undefined;
  return data?.userId;
}

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: () => new WsException('Dados inválidos'),
  }),
)
@WebSocketGateway({ namespace: 'chats' })
export class ChatsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server: Namespace;

  private readonly logger = new Logger(ChatsGateway.name);

  constructor(
    private chatsService: ChatsService,
    private socketAuthService: SocketAuthService,
  ) {}

  afterInit(server: Namespace) {
    server.use((socket, next) => {
      this.socketAuthService
        .authenticate(socket)
        .then((userId) => {
          if (!userId) {
            next(new Error('Não autenticado'));
            return;
          }
          (socket.data as ChatSocketData).userId = userId;
          next();
        })
        .catch(() => next(new Error('Não autenticado')));
    });
  }

  /**
   * Quando um usuário conecta ao WebSocket
   */
  async handleConnection(client: Socket) {
    const userId = socketUserId(client);
    if (userId) {
      await client.join(`user:${userId}`);
    }
  }

  @SubscribeMessage('auth')
  handleAuth(@ConnectedSocket() client: Socket) {
    client.emit('auth:success', { message: 'Autenticado com sucesso' });
    return { success: true };
  }

  /**
   * Entrar em um chat (começar a receber mensagens desse chat)
   * Cliente envia: { chatId: string }
   */
  @SubscribeMessage('chat:join')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatRoomDto,
  ) {
    const userId = this.requireUserId(client);

    if (!(await this.chatsService.isMember(data.chatId, userId))) {
      client.emit('error', { message: 'Você não é membro deste chat' });
      return { success: false };
    }

    const roomName = `chat:${data.chatId}`;
    await client.join(roomName);

    this.server.to(roomName).emit('chat:user-joined', {
      userId,
      chatId: data.chatId,
      timestamp: new Date(),
    });
    return { success: true };
  }

  /**
   * Sair de um chat
   * Cliente envia: { chatId: string }
   */
  @SubscribeMessage('chat:leave')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatRoomDto,
  ) {
    const userId = this.requireUserId(client);
    const roomName = `chat:${data.chatId}`;
    await client.leave(roomName);

    this.server.to(roomName).emit('chat:user-left', {
      userId,
      chatId: data.chatId,
      timestamp: new Date(),
    });
  }

  /**
   * Enviar mensagem em tempo real
   * Cliente envia: { chatId: string, content: string, imageUrl?: string }
   */
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SocketSendMessageDto,
  ) {
    try {
      const userId = this.requireUserId(client);

      // Salvar mensagem no banco de dados
      const message = await this.chatsService.sendMessage(data.chatId, userId, {
        content: data.content,
        imageUrl: data.imageUrl,
      });

      const roomName = `chat:${data.chatId}`;

      // Emitir para todos os usuários do chat
      this.server.to(roomName).emit('message:new', {
        id: message.id,
        chatId: message.chatId,
        userId: message.userId,
        content: message.content,
        imageUrl: message.imageUrl,
        isRead: false,
        createdAt: message.createdAt,
        user: {
          id: message.user?.id,
          name: message.user?.name,
          nickname: message.user?.nickname,
          avatarUrl: message.user?.avatarUrl,
        },
      });

      // 👇 Avisa as Salas Pessoais para atualizarem a lista global
      await this.notifyMembersListUpdate(data.chatId);

      return { success: true, messageId: message.id };
    } catch (error) {
      this.logger.warn(`Erro ao enviar mensagem: ${this.errorMessage(error)}`);
      client.emit('error', {
        message: this.errorMessage(error, 'Erro ao enviar mensagem'),
      });
    }
  }

  /**
   * Marcar mensagens como lidas
   * Cliente envia: { chatId: string }
   */
  @SubscribeMessage('message:mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatRoomDto,
  ) {
    try {
      const userId = this.requireUserId(client);

      await this.chatsService.markMessagesAsRead(data.chatId, userId);
      const roomName = `chat:${data.chatId}`;

      // Notificar que mensagens foram lidas
      this.server.to(roomName).emit('message:marked-read', {
        chatId: data.chatId,
        userId,
        timestamp: new Date(),
      });

      // 👇 Avisa as Salas Pessoais para atualizarem a bolinha vermelha na lista
      await this.notifyMembersListUpdate(data.chatId);

      return { success: true };
    } catch (error) {
      this.logger.warn(`Erro ao marcar como lido: ${this.errorMessage(error)}`);
      client.emit('error', {
        message: this.errorMessage(error, 'Erro ao marcar como lido'),
      });
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @MessageBody() data: SocketEditMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.requireUserId(client);
      const updatedMessage = await this.chatsService.editMessage(
        data.messageId,
        userId,
        data.newText,
      );
      this.broadcastToChat(
        updatedMessage.chatId,
        'messageEdited',
        updatedMessage,
      );
    } catch (error) {
      client.emit('error', {
        message: this.errorMessage(error, 'Erro ao editar mensagem'),
      });
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody() data: SocketDeleteMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.requireUserId(client);
      const deletedMessage = await this.chatsService.deleteMessage(
        data.messageId,
        userId,
      );
      this.broadcastToChat(
        deletedMessage.chatId,
        'messageDeleted',
        deletedMessage,
      );
    } catch (error) {
      client.emit('error', {
        message: this.errorMessage(error, 'Erro ao apagar mensagem'),
      });
    }
  }

  /**
   * Emitir para todos os clientes de um chat
   */
  broadcastToChat(chatId: string, event: string, data: unknown) {
    this.server.to(`chat:${chatId}`).emit(event, data);
  }

  private async notifyMembersListUpdate(chatId: string) {
    const memberIds = await this.chatsService.getMemberIds(chatId);
    memberIds.forEach((memberId) => {
      this.server.to(`user:${memberId}`).emit('chat:list-update');
    });
  }

  private requireUserId(client: Socket): string {
    const userId = socketUserId(client);
    if (!userId) throw new WsException('Não autenticado');
    return userId;
  }

  private errorMessage(error: unknown, fallback = 'Erro inesperado') {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
