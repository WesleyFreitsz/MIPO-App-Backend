import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { SocketAuthService } from 'src/auth/socket-auth.service';
import { User, UserRole } from 'src/users/entities/user.entity';

export const STAFF_ROOM = 'staff';
const STAFF_ROLES = [UserRole.ADMIN, UserRole.WAITER];

interface NotificationSocketData {
  userId?: string;
}

@WebSocketGateway()
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly socketAuthService: SocketAuthService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

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
    if (!userId) return;
    await client.join(`user:${userId}`);
    const isStaff = await this.userRepository.exists({
      where: { id: userId, role: In(STAFF_ROLES) },
    });
    if (isStaff) await client.join(STAFF_ROOM);
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

  emitToStaff(event: string, payload: unknown) {
    this.server.to(STAFF_ROOM).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
