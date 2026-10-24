import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketAuthService } from 'src/auth/socket-auth.service';

interface NotificationSocketData {
  userId?: string;
}

@WebSocketGateway()
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly socketAuthService: SocketAuthService) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      this.socketAuthService
        .authenticate(socket)
        .then((userId) => {
          if (!userId) {
            next(new Error('Não autenticado'));
            return;
          }
          (socket.data as NotificationSocketData).userId = userId;
          next();
        })
        .catch(() => next(new Error('Não autenticado')));
    });
  }

  async handleConnection(client: Socket) {
    const userId = (client.data as NotificationSocketData | undefined)?.userId;
    if (userId) {
      await client.join(`user:${userId}`);
    }
  }

  @SubscribeMessage('auth')
  handleAuth(@ConnectedSocket() client: Socket) {
    client.emit('auth:success', { message: 'Autenticado com sucesso' });
    return { success: true };
  }

  sendRealTimeNotification(userId: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }

  broadcast(payload: unknown) {
    this.server.emit('notification:new', payload);
  }
}
