import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Notifications } from './entities/notifications.entity';
import { User, UserRole } from 'src/users/entities/user.entity';
import { Expo } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private expo = new Expo(); // Inicializa o cliente da Expo

  constructor(
    @InjectRepository(Notifications)
    private notifRepository: Repository<Notifications>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // --- LÓGICA DE ENVIO PUSH (PRIVADA) ---
  private async sendPush(
    to: string | string[],
    title: string,
    body: string,
    data?: any,
  ) {
    // Se for string única, transforma em array
    const tokens = Array.isArray(to) ? to : [to];

    // Filtra apenas tokens válidos da Expo
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));

    if (validTokens.length === 0) return;

    const messages = validTokens.map((token) => ({
      to: token,
      sound: 'default' as const, // 'as const' ajuda na tipagem
      title,
      body,
      data: { ...data },
    }));

    // O Expo recomenda enviar em lotes (chunks)
    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Erro ao enviar chunk de notificações:', error);
      }
    }
  }

  // --- MÉTODOS PÚBLICOS ---

  // 1. Enviar para um usuário específico
  async sendToUser(
    userId: string,
    title: string,
    message: string,
    icon?: string,
  ) {
    // Carrega o usuário completo para evitar partial entity
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Salva no banco (Histórico) usando a entidade completa
    const notification = this.notifRepository.create({
      title,
      message,
      icon,
      user, // Usa a entidade completa
    });
    await this.notifRepository.save(notification);

    // Envia Push Notification (Celular)
    // Verificação simples se existe e não é null
    if (user.notificationToken) {
      await this.sendPush(user.notificationToken, title, message);
    }

    return notification;
  }

  // 2. Enviar para todos os Admins
  async notifyAdmins(title: string, message: string) {
    const admins = await this.userRepository.find({
      where: { role: UserRole.ADMIN },
    });

    // Salva no banco para cada admin, usando a entidade completa
    const dbPromises = admins.map((admin) =>
      this.notifRepository.save(
        this.notifRepository.create({
          title,
          message,
          icon: 'shield',
          user: admin, // Usa a entidade completa
        }),
      ),
    );
    await Promise.all(dbPromises);

    // Coleta tokens e envia Push em lote
    // CORREÇÃO: Usamos o Type Guard (t is string) para garantir ao TS que removemos os nulos
    const tokens = admins
      .map((a) => a.notificationToken)
      .filter((t): t is string => !!t);

    if (tokens.length > 0) {
      await this.sendPush(tokens, title, message);
    }
  }

  // 3. Enviar para todos os usuários (Broadcast)
  async broadcast(title: string, message: string, icon?: string) {
    // Salva UMA vez no banco como global (user: null)
    const notification = this.notifRepository.create({
      title,
      message,
      icon,
      user: null, // null indica para todos
    });
    await this.notifRepository.save(notification);

    // Envia Push para TODOS que têm token
    const usersWithToken = await this.userRepository
      .createQueryBuilder('user')
      .where('user.notificationToken IS NOT NULL')
      .select(['user.notificationToken'])
      .getMany();

    // CORREÇÃO: Filtramos novamente para garantir a tipagem string[]
    const tokens = usersWithToken
      .map((u) => u.notificationToken)
      .filter((t): t is string => !!t);

    if (tokens.length > 0) {
      await this.sendPush(tokens, title, message);
    }

    return notification;
  }

  // 4. Buscar notificações do usuário (Específicas + Globais)
  async getUserNotifications(userId: string) {
    return this.notifRepository.find({
      where: [
        { user: { id: userId } }, // Direcionadas a ele
        { user: IsNull() }, // Globais (Broadcasts)
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // 5. Marcar como lida
  async markAsRead(id: string) {
    // Nota: Notificações globais (user: null) são difíceis de marcar como lidas individualmente
    // sem uma tabela pivô. Este método funcionará bem para notificações diretas.
    await this.notifRepository.update(id, { isRead: true });
    return { message: 'Lida' };
  }
}
