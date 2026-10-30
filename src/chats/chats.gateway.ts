import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Namespace, Socket } from 'socket.io';
import { Expo } from 'expo-server-sdk';
import { ChatsService } from './chats.service';
import { SocketAuthService } from 'src/auth/socket-auth.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import {
  ChatRoomDto,
  SocketSendMessageDto,
  SocketTypingDto,
  SocketWatchPresenceDto,
} from './dto/chat-socket.dto';
import { ChatMessage } from './entities/chat-message.entity';
import { Chat, ChatType } from './entities/chat.entity';

interface ChatSocketData {
  userId?: string;
}

const PUSH_BODY_MAX_LENGTH = 120;

function socketUserId(client: Socket): string | undefined {
  const data = client.data as ChatSocketData | undefined;
  return data?.userId;
}

const chatRoom = (chatId: string) => `chat:${chatId}`;
const userRoom = (userId: string) => `user:${userId}`;
const presenceRoom = (userId: string) => `presence:${userId}`;

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: () => new WsException('Dados inválidos'),
  }),
)
@WebSocketGateway({ namespace: 'chats' })
export class ChatsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Namespace;

  private readonly logger = new Logger(ChatsGateway.name);
  private readonly expo = new Expo();

  constructor(
    private chatsService: ChatsService,
    private socketAuthService: SocketAuthService,
    private notificationsService: NotificationsService,
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

  async handleConnection(client: Socket) {
    const userId = socketUserId(client);
    if (!userId) return;
    await client.join(userRoom(userId));
    this.server
      .to(presenceRoom(userId))
      .emit('presence:update', { userId, online: true, lastSeenAt: null });
  }

  async handleDisconnect(client: Socket) {
    const userId = socketUserId(client);
    if (!userId || (await this.isOnline(userId))) return;
    try {
      const lastSeenAt = await this.chatsService.touchLastSeen(userId);
      this.server
        .to(presenceRoom(userId))
        .emit('presence:update', { userId, online: false, lastSeenAt });
    } catch (error) {
      this.logger.warn(`Erro ao salvar presença: ${this.errorMessage(error)}`);
    }
  }

  @SubscribeMessage('auth')
  handleAuth(@ConnectedSocket() client: Socket) {
    client.emit('auth:success', { message: 'Autenticado com sucesso' });
    return { success: true };
  }

  @SubscribeMessage('chat:join')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatRoomDto,
  ) {
    const userId = this.requireUserId(client);
    if (!(await this.chatsService.isMember(data.chatId, userId))) {
      return { success: false, error: 'Você não é membro deste chat' };
    }
    await client.join(chatRoom(data.chatId));
    return { success: true };
  }

  @SubscribeMessage('chat:leave')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatRoomDto,
  ) {
    await client.leave(chatRoom(data.chatId));
    return { success: true };
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SocketSendMessageDto,
  ) {
    try {
      const userId = this.requireUserId(client);
      const { message, memberIds, chat, duplicate } =
        await this.chatsService.sendMessage(data.chatId, userId, data);
      if (!duplicate) {
        this.publishMessage(message, memberIds, chat, data.clientId);
      }
      return {
        success: true,
        message: { ...message, clientId: data.clientId },
      };
    } catch (error) {
      this.logger.warn(`Erro ao enviar mensagem: ${this.errorMessage(error)}`);
      return {
        success: false,
        error: this.errorMessage(error, 'Erro ao enviar mensagem'),
      };
    }
  }

  @SubscribeMessage('message:mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatRoomDto,
  ) {
    try {
      const userId = this.requireUserId(client);
      await this.chatsService.markMessagesAsRead(data.chatId, userId);
      this.publishRead(data.chatId, userId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: this.errorMessage(error, 'Erro ao marcar como lido'),
      };
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SocketTypingDto,
  ) {
    const userId = this.requireUserId(client);
    const room = chatRoom(data.chatId);
    if (!client.rooms.has(room)) return { success: false };
    client
      .to(room)
      .emit('typing', { chatId: data.chatId, userId, isTyping: data.isTyping });
    return { success: true };
  }

  @SubscribeMessage('presence:watch')
  async handleWatchPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SocketWatchPresenceDto,
  ) {
    const viewerId = this.requireUserId(client);
    if (!(await this.chatsService.canWatchPresence(viewerId, data.userId))) {
      return { userId: data.userId, online: false, lastSeenAt: null };
    }
    await client.join(presenceRoom(data.userId));
    const online = await this.isOnline(data.userId);
    return {
      userId: data.userId,
      online,
      lastSeenAt: online
        ? null
        : await this.chatsService.getLastSeen(data.userId),
    };
  }

  @SubscribeMessage('presence:unwatch')
  async handleUnwatchPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SocketWatchPresenceDto,
  ) {
    await client.leave(presenceRoom(data.userId));
    return { success: true };
  }

  publishMessage(
    message: ChatMessage,
    memberIds: string[],
    chat: Pick<Chat, 'id' | 'type' | 'name'>,
    clientId?: string,
  ) {
    this.server
      .to(chatRoom(message.chatId))
      .emit('message:new', { ...message, clientId });
    this.notifyListUpdate(memberIds);
    this.pushToAbsentMembers(message, memberIds, chat).catch((error) =>
      this.logger.warn(`Erro ao enviar push: ${this.errorMessage(error)}`),
    );
  }

  async publishUpdatedMessage(message: ChatMessage) {
    this.server.to(chatRoom(message.chatId)).emit('message:updated', message);
    this.notifyListUpdate(await this.chatsService.getMemberIds(message.chatId));
  }

  publishRead(chatId: string, userId: string) {
    this.server
      .to(chatRoom(chatId))
      .emit('message:marked-read', { chatId, userId, timestamp: new Date() });
    this.notifyListUpdate([userId]);
  }

  private notifyListUpdate(userIds: string[]) {
    userIds.forEach((id) =>
      this.server.to(userRoom(id)).emit('chat:list-update'),
    );
  }

  private async pushToAbsentMembers(
    message: ChatMessage,
    memberIds: string[],
    chat: Pick<Chat, 'id' | 'type' | 'name'>,
  ) {
    const sockets = await this.server
      .in(chatRoom(message.chatId))
      .fetchSockets();
    const presentIds = new Set(
      sockets.map((s) => (s.data as ChatSocketData).userId),
    );
    const absentIds = memberIds.filter(
      (id) => id !== message.userId && !presentIds.has(id),
    );
    const pushData = { type: 'chat', chatId: message.chatId };
    const [recipients, pushDisabled] = await Promise.all([
      this.chatsService.getPushRecipients(absentIds),
      this.notificationsService.usersWithPushDisabled(absentIds, pushData),
    ]);
    const tokens = recipients
      .filter((r) => !pushDisabled.has(r.id))
      .map((r) => r.notificationToken)
      .filter((t): t is string => !!t && Expo.isExpoPushToken(t));
    if (tokens.length === 0) return;

    const sender = message.user?.nickname || message.user?.name || 'Alguém';
    const text = message.content
      ? message.content.slice(0, PUSH_BODY_MAX_LENGTH)
      : '📷 Imagem';
    const isPrivate = chat.type === ChatType.PRIVATE;
    const notifications = tokens.map((to) => ({
      to,
      sound: 'default' as const,
      title: isPrivate ? sender : chat.name,
      body: isPrivate ? text : `${sender}: ${text}`,
      data: pushData,
    }));
    for (const chunk of this.expo.chunkPushNotifications(notifications)) {
      await this.expo.sendPushNotificationsAsync(chunk);
    }
  }

  private async isOnline(userId: string) {
    const sockets = await this.server.in(userRoom(userId)).fetchSockets();
    return sockets.length > 0;
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
