import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Notifications } from './entities/notifications.entity';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Expo } from 'expo-server-sdk';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private expo = new Expo();
  private readonly MAX_NOTIFICATIONS = 50;

  constructor(
    @InjectRepository(Notifications)
    private notifRepository: Repository<Notifications>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsGateway: NotificationsGateway,
  ) {}

  private async sendPush(
    to: string | string[],
    title: string,
    body: string,
    data?: any,
  ) {
    const tokens = Array.isArray(to) ? to : [to];
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));

    if (validTokens.length === 0) return;

    const messages = validTokens.map((token) => ({
      to: token,
      sound: 'default' as const,
      title,
      body,
      data: { ...data },
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Erro ao enviar push:', error);
      }
    }
  }

  // NOVO: Adicionado o parâmetro opcional 'data' para guardar as referências de navegação
  async sendToUser(
    userId: string,
    title: string,
    message: string,
    icon?: string,
    type: string = 'ALERT',
    data?: any,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // 1. SEMPRE guarda na base de dados (mesmo sem Push)
    const notification = this.notifRepository.create({
      title,
      message,
      icon,
      user,
      data, // Guarda os dados extra
    });
    await this.notifRepository.save(notification);

    // 2. Envia por WebSocket em tempo real
    this.notificationsGateway.sendRealTimeNotification(userId, {
      title,
      message,
      type,
      data,
    });

    // 3. SE o usuário aceitou notificações Push, dispara pro celular
    if (user.notificationToken) {
      await this.sendPush(user.notificationToken, title, message, data);
    }

    await this.pruneOldNotifications(userId);
    return notification;
  }

  private async pruneOldNotifications(userId: string) {
    const notifications = await this.notifRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      select: ['id'],
    });

    if (notifications.length > this.MAX_NOTIFICATIONS) {
      const idsToDelete = notifications
        .slice(this.MAX_NOTIFICATIONS)
        .map((n) => n.id);

      if (idsToDelete.length > 0) {
        await this.notifRepository.delete(idsToDelete);
      }
    }
  }

  async notifyAdmins(title: string, message: string, data?: any) {
    const admins = await this.userRepository.find({
      where: { role: UserRole.ADMIN },
    });

    const dbPromises = admins.map((admin) =>
      this.notifRepository.save(
        this.notifRepository.create({
          title,
          message,
          icon: 'shield',
          user: admin,
          data,
        }),
      ),
    );
    await Promise.all(dbPromises);

    admins.forEach((admin) => {
      this.notificationsGateway.sendRealTimeNotification(admin.id, {
        title,
        message,
        type: 'ADMIN_ALERT',
        data,
      });
    });

    await Promise.all(
      admins.map((admin) => this.pruneOldNotifications(admin.id)),
    );

    const tokens = admins
      .map((a) => a.notificationToken)
      .filter((t): t is string => !!t);
    if (tokens.length > 0) {
      await this.sendPush(tokens, title, message, data);
    }
  }

  async broadcast(title: string, message: string, icon?: string, data?: any) {
    const users = await this.userRepository.find();
    const dbPromises = users.map((user) =>
      this.notifRepository.save(
        this.notifRepository.create({
          title,
          message,
          icon,
          user,
          data,
        }),
      ),
    );
    await Promise.all(dbPromises);

    this.notificationsGateway.broadcast({
      title,
      message,
      type: 'GLOBAL_ALERT',
      data,
    });

    const tokens = users
      .map((u) => u.notificationToken)
      .filter((t): t is string => !!t);

    if (tokens.length > 0) {
      await this.sendPush(tokens, title, message, data);
    }
    return { message: 'Notificação global enviada a todos com sucesso' };
  }

  async getUserNotifications(userId: string, skip = 0, take = 20) {
    const [data, total] = await this.notifRepository.findAndCount({
      where: [{ user: { id: userId } }, { user: IsNull() }],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { data, total, skip, take, hasMore: total > skip + take };
  }

  async markAsRead(id: string) {
    await this.notifRepository.update(id, { isRead: true });
    return { message: 'Lida' };
  }

  async markAllAsRead(userId: string) {
    await this.notifRepository.update(
      { user: { id: userId } },
      { isRead: true },
    );
    return { message: 'Todas as notificações foram lidas' };
  }
}
