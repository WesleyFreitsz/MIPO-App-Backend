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

  // Limite máximo de notificações mantidas por utilizador no banco de dados
  private readonly MAX_NOTIFICATIONS = 50;

  constructor(
    @InjectRepository(Notifications)
    private notifRepository: Repository<Notifications>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsGateway: NotificationsGateway, // Injetando o Gateway
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

  async sendToUser(
    userId: string,
    title: string,
    message: string,
    icon?: string,
    type: string = 'ALERT',
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const notification = this.notifRepository.create({
      title,
      message,
      icon,
      user,
    });
    await this.notifRepository.save(notification);

    this.notificationsGateway.sendRealTimeNotification(userId, {
      title,
      message,
      type,
    });

    if (user.notificationToken) {
      await this.sendPush(user.notificationToken, title, message);
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

  async notifyAdmins(title: string, message: string) {
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
        }),
      ),
    );
    await Promise.all(dbPromises);

    admins.forEach((admin) => {
      this.notificationsGateway.sendRealTimeNotification(admin.id, {
        title,
        message,
        type: 'ADMIN_ALERT',
      });
    });

    await Promise.all(
      admins.map((admin) => this.pruneOldNotifications(admin.id)),
    );

    const tokens = admins
      .map((a) => a.notificationToken)
      .filter((t): t is string => !!t);
    if (tokens.length > 0) {
      await this.sendPush(tokens, title, message);
    }
  }

  async broadcast(title: string, message: string, icon?: string) {
    const notification = this.notifRepository.create({
      title,
      message,
      icon,
      user: null,
    });
    await this.notifRepository.save(notification);

    this.notificationsGateway.broadcast({
      title,
      message,
      type: 'GLOBAL_ALERT',
    });

    const usersWithToken = await this.userRepository
      .createQueryBuilder('user')
      .where('user.notificationToken IS NOT NULL')
      .select(['user.notificationToken'])
      .getMany();

    const tokens = usersWithToken
      .map((u) => u.notificationToken)
      .filter((t): t is string => !!t);
    if (tokens.length > 0) {
      await this.sendPush(tokens, title, message);
    }

    return notification;
  }

  async getUserNotifications(userId: string, skip = 0, take = 20) {
    const [data, total] = await this.notifRepository.findAndCount({
      where: [{ user: { id: userId } }, { user: IsNull() }],
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    return {
      data,
      total,
      skip,
      take,
      hasMore: total > skip + take,
    };
  }

  async markAsRead(id: string) {
    await this.notifRepository.update(id, { isRead: true });
    return { message: 'Lida' };
  }
}
