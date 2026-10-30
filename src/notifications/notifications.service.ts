import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository, IsNull, In, LessThanOrEqual } from 'typeorm';
import { Notifications } from './entities/notifications.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { ScheduledNotification } from './entities/scheduled-notification.entity';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Event } from 'src/events/entities/event.entity';
import { Expo } from 'expo-server-sdk';
import { NotificationsGateway } from './notifications.gateway';
import {
  NOTIFICATION_CATEGORIES,
  notificationCategory,
} from './notification-category';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

const BROADCAST_INSERT_CHUNK = 500;

type NotificationData = Record<string, unknown>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private expo = new Expo();
  private readonly MAX_NOTIFICATIONS = 50;

  constructor(
    @InjectRepository(Notifications)
    private notifRepository: Repository<Notifications>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(NotificationPreference)
    private preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(ScheduledNotification)
    private scheduledRepository: Repository<ScheduledNotification>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private notificationsGateway: NotificationsGateway,
  ) {}

  private async sendPush(
    to: string | string[],
    title: string,
    body: string,
    data?: NotificationData,
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
      ...(data?.type === 'order'
        ? { channelId: 'orders', priority: 'high' as const }
        : {}),
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        this.logger.error(
          'Erro ao enviar push',
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  async usersWithPushDisabled(
    userIds: string[],
    data?: NotificationData,
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const disabled = await this.preferenceRepository.find({
      where: {
        userId: In(userIds),
        type: notificationCategory(data),
        enabled: false,
      },
      select: { userId: true },
    });
    return new Set(disabled.map((p) => p.userId));
  }

  // NOVO: Adicionado o parâmetro opcional 'data' para guardar as referências de navegação
  async sendToUser(
    userId: string,
    title: string,
    message: string,
    icon?: string,
    type: string = 'ALERT',
    data?: NotificationData,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, notificationToken: true },
    });
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
    const pushDisabled = await this.usersWithPushDisabled([userId], data);
    if (user.notificationToken && !pushDisabled.has(userId)) {
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

  async notifyAdmins(
    title: string,
    message: string,
    data?: NotificationData,
    roles: UserRole[] = [UserRole.ADMIN],
  ) {
    const admins = await this.userRepository.find({
      where: { role: In(roles) },
      select: { id: true, notificationToken: true },
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

  async broadcast(
    title: string,
    message: string,
    icon?: string,
    data?: NotificationData,
  ) {
    const users = await this.userRepository.find({
      where: { banned: false },
      select: { id: true, notificationToken: true },
    });

    const rows = users.map((user) =>
      this.notifRepository.create({
        title,
        message,
        icon,
        data,
        user: { id: user.id },
      }),
    );
    await this.notifRepository.save(rows, { chunk: BROADCAST_INSERT_CHUNK });

    this.notificationsGateway.broadcast({
      title,
      message,
      type: 'GLOBAL_ALERT',
      data,
    });

    const pushDisabled = await this.usersWithPushDisabled(
      users.map((u) => u.id),
      data,
    );
    const tokens = users
      .filter((u) => !pushDisabled.has(u.id))
      .map((u) => u.notificationToken)
      .filter((t): t is string => !!t);

    if (tokens.length > 0) {
      await this.sendPush(tokens, title, message, data);
    }
    return { message: 'Notificação global enviada a todos com sucesso' };
  }

  async sendToUsers(
    userIds: string[],
    title: string,
    message: string,
    icon?: string,
    data?: NotificationData,
  ) {
    for (const userId of userIds) {
      try {
        await this.sendToUser(userId, title, message, icon, 'ALERT', data);
      } catch (error) {
        this.logger.warn(
          `Falha ao notificar ${userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async adminBroadcast(dto: BroadcastNotificationDto) {
    if (dto.sendAt && new Date(dto.sendAt).getTime() > Date.now()) {
      const scheduled = this.scheduledRepository.create({
        title: dto.title,
        message: dto.message,
        icon: dto.icon ?? null,
        eventId: dto.eventId ?? null,
        sendAt: new Date(dto.sendAt),
      });
      return this.scheduledRepository.save(scheduled);
    }
    await this.deliverBroadcast(
      dto.title,
      dto.message,
      dto.icon ?? null,
      dto.eventId ?? null,
    );
    return { message: 'Notificação enviada com sucesso' };
  }

  private async deliverBroadcast(
    title: string,
    message: string,
    icon: string | null,
    eventId: string | null,
  ) {
    if (!eventId) {
      await this.broadcast(title, message, icon ?? undefined, {
        type: 'general',
      });
      return;
    }
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['participants'],
    });
    if (!event) throw new BadRequestException('Evento não encontrado');
    await this.sendToUsers(
      event.participants.map((p) => p.id),
      title,
      message,
      icon ?? 'calendar',
      { type: 'event', eventId },
    );
  }

  findScheduled() {
    return this.scheduledRepository.find({
      where: { sentAt: IsNull() },
      order: { sendAt: 'ASC' },
    });
  }

  async cancelScheduled(id: string) {
    const result = await this.scheduledRepository.delete({
      id,
      sentAt: IsNull(),
    });
    if (!result.affected) {
      throw new NotFoundException('Agendamento não encontrado');
    }
    return { message: 'Agendamento cancelado' };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueScheduled() {
    const due = await this.scheduledRepository.find({
      where: { sentAt: IsNull(), sendAt: LessThanOrEqual(new Date()) },
    });
    for (const item of due) {
      // Marca antes de enviar para não duplicar se o envio demorar mais que o intervalo do cron
      await this.scheduledRepository.update(item.id, { sentAt: new Date() });
      try {
        await this.deliverBroadcast(
          item.title,
          item.message,
          item.icon,
          item.eventId,
        );
      } catch (error) {
        this.logger.error(
          `Falha no envio agendado ${item.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  async getPreferences(userId: string) {
    const saved = await this.preferenceRepository.find({ where: { userId } });
    return NOTIFICATION_CATEGORIES.map((type) => ({
      type,
      enabled: saved.find((p) => p.type === type)?.enabled ?? true,
    }));
  }

  async updatePreference(userId: string, type: string, enabled: boolean) {
    await this.preferenceRepository.upsert({ userId, type, enabled }, [
      'userId',
      'type',
    ]);
    return this.getPreferences(userId);
  }

  async remove(id: string, userId: string) {
    const result = await this.notifRepository.delete({
      id,
      user: { id: userId },
    });
    if (!result.affected) {
      throw new NotFoundException('Notificação não encontrada');
    }
    return { message: 'Notificação apagada' };
  }

  async removeAll(userId: string) {
    await this.notifRepository.delete({ user: { id: userId } });
    return { message: 'Notificações apagadas' };
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

  async markAsRead(id: string, userId: string) {
    const result = await this.notifRepository.update(
      { id, user: { id: userId } },
      { isRead: true },
    );
    if (!result.affected) {
      throw new NotFoundException('Notificação não encontrada');
    }
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
