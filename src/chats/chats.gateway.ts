import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatsService } from './chats.service';
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'chats' })
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // Map para rastrear usuários conectados: userId -> socket id
  private userSockets = new Map<string, string>();
  // Map para rastrear qual chat cada socket está escutando
  private socketChats = new Map<string, string[]>();

  constructor(private chatsService: ChatsService) {}

  /**
   * Quando um usuário conecta ao WebSocket
   */
  handleConnection(client: Socket) {
    console.log(`[WS] Cliente conectado: ${client.id}`);
  }

  /**
   * Quando um usuário desconecta do WebSocket
   */
  handleDisconnect(client: Socket) {
    console.log(`[WS] Cliente desconectado: ${client.id}`);
    // Remove do mapa de usuários
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        break;
      }
    }
    // Remove dos chats que estava escutando
    this.socketChats.delete(client.id);
  }

  /**
   * Autenticar usuário e registrar sua conexão
   * Cliente envia: { userId: string }
   */
  @SubscribeMessage('auth')
  handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    this.userSockets.set(data.userId, client.id);
    client.data.userId = data.userId;
    console.log(`[WS] Usuário autenticado: ${data.userId} -> ${client.id}`);
    client.emit('auth:success', { message: 'Autenticado com sucesso' });
    return { success: true };
  }

  /**
   * Entrar em um chat (começar a receber mensagens desse chat)
   * Cliente envia: { chatId: string }
   */
  @SubscribeMessage('chat:join')
  handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const roomName = `chat:${data.chatId}`;
    client.join(roomName);

    // Rastrear quais chats esse socket está escutando
    if (!this.socketChats.has(client.id)) {
      this.socketChats.set(client.id, []);
    }
    const chats = this.socketChats.get(client.id);
    if (chats) chats.push(data.chatId);

    console.log(`[WS] Usuário entrou no chat: ${data.chatId}`);
    // Notificar todos que alguém entrou no chat
    this.server.to(roomName).emit('chat:user-joined', {
      userId: client.data.userId,
      chatId: data.chatId,
      timestamp: new Date(),
    });
  }

  /**
   * Sair de um chat
   * Cliente envia: { chatId: string }
   */
  @SubscribeMessage('chat:leave')
  handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const roomName = `chat:${data.chatId}`;
    client.leave(roomName);

    // Remover do rastreamento
    const chats = this.socketChats.get(client.id);
    if (chats) {
      this.socketChats.set(
        client.id,
        chats.filter((c) => c !== data.chatId),
      );
    }

    console.log(`[WS] Usuário saiu do chat: ${data.chatId}`);
    this.server.to(roomName).emit('chat:user-left', {
      userId: client.data.userId,
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
    @MessageBody() data: { chatId: string; content: string; imageUrl?: string },
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        client.emit('error', { message: 'Não autenticado' });
        return;
      }

      // Salvar mensagem no banco de dados
      const message = await this.chatsService.sendMessage(data.chatId, userId, {
        content: data.content,
        imageUrl: data.imageUrl,
      } as SendMessageDto);

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

      console.log(`[WS] Mensagem enviada no chat ${data.chatId} por ${userId}`);
      return { success: true, messageId: message.id };
    } catch (error) {
      console.error('[WS] Erro ao enviar mensagem:', error);
      client.emit('error', {
        message: error.message || 'Erro ao enviar mensagem',
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
    @MessageBody() data: { chatId: string },
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        client.emit('error', { message: 'Não autenticado' });
        return;
      }

      await this.chatsService.markMessagesAsRead(data.chatId, userId);
      const roomName = `chat:${data.chatId}`;

      // Notificar que mensagens foram lidas
      this.server.to(roomName).emit('message:marked-read', {
        chatId: data.chatId,
        userId,
        timestamp: new Date(),
      });

      console.log(`[WS] Mensagens marcadas como lidas no chat ${data.chatId}`);
      return { success: true };
    } catch (error) {
      console.error('[WS] Erro ao marcar como lido:', error);
      client.emit('error', {
        message: error.message || 'Erro ao marcar como lido',
      });
    }
  }

  /**
   * Emitir para todos os clientes de um chat
   */
  broadcastToChat(chatId: string, event: string, data: any) {
    this.server.to(`chat:${chatId}`).emit(event, data);
  }
}
