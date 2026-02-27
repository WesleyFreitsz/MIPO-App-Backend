import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship, FriendshipStatus } from './entities/friendship.entity';
import { User } from '../users/entities/user.entity';
import { CreateFriendshipDto } from './dto/create-friendship.dto';
import { NotificationsService } from '../notifications/notifications.service'; // <--- IMPORTADO
import { AchievementsService } from 'src/achievements/achievements.service';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friendship)
    private friendshipRepository: Repository<Friendship>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private notificationsService: NotificationsService, 
    private achievementsService: AchievementsService, 
  ) {}

  /**
   * Enviar solicitação de amizade
   */
  async sendFriendRequest(userId: string, dto: CreateFriendshipDto) {
    const friendUser = await this.usersRepository.findOne({
      where: { id: dto.friendId },
    });

    if (!friendUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (userId === dto.friendId) {
      throw new BadRequestException('Você não pode adicionar a si mesmo');
    }

    // Verifica se já existe um relacionamento
    const existingFriendship = await this.friendshipRepository.findOne({
      where: [
        { userId, friendId: dto.friendId },
        { userId: dto.friendId, friendId: userId },
      ],
    });

    if (existingFriendship) {
      if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
        throw new ConflictException('Você já é amigo deste usuário');
      }
      if (existingFriendship.status === FriendshipStatus.PENDING) {
        // --- FIX DO BUG ---
        // Se a solicitação PENDENTE foi enviada pelo OUTRO usuário para VOCÊ:
        if (
          existingFriendship.userId === dto.friendId &&
          existingFriendship.friendId === userId
        ) {
          // Aceita a amizade automaticamente!
          existingFriendship.status = FriendshipStatus.ACCEPTED;
          const saved =
            await this.friendshipRepository.save(existingFriendship);

          // Notifica o outro usuário que você aceitou
          const requester = await this.usersRepository.findOne({
            where: { id: userId },
          });
          if (requester) {
            await this.notificationsService.sendToUser(
              dto.friendId,
              'Nova Amizade! 🎉',
              `Você e @${requester.nickname || requester.name} agora são amigos.`,
              'user-check',
              'ALERT',
              { userId: userId }, // Navegar para o seu perfil
            );
          }
          return saved;
        } else {
          throw new ConflictException(
            'Solicitação de amizade já foi enviada para este usuário',
          );
        }
      }
    }

    // Se não existir, cria a solicitação normal
    const friendship = this.friendshipRepository.create({
      userId,
      friendId: dto.friendId,
      status: FriendshipStatus.PENDING,
    });
    const savedFriendship = await this.friendshipRepository.save(friendship);

    // --- ENVIAR NOTIFICAÇÃO DE SOLICITAÇÃO ---
    const requesterInfo = await this.usersRepository.findOne({
      where: { id: userId },
    });
    if (requesterInfo) {
      await this.notificationsService.sendToUser(
        dto.friendId,
        'Novo pedido de amizade! 🤝',
        `@${requesterInfo.nickname || requesterInfo.name} quer se conectar com você.`,
        'user-plus',
        'ALERT',
        { userId: userId }, // Navegar para o perfil de quem pediu
      );
    }

    return savedFriendship;
  }

  async acceptFriendRequest(userId: string, friendshipId: string) {
    const friendship = await this.friendshipRepository.findOne({
      where: { id: friendshipId },
      relations: ['user', 'friend'], 
    });

    if (!friendship) throw new NotFoundException('Solicitação não encontrada');
    if (friendship.friendId !== userId) throw new BadRequestException('Você não pode aceitar esta solicitação');
    if (friendship.status !== FriendshipStatus.PENDING) throw new BadRequestException('Esta solicitação já foi processada');

    friendship.status = FriendshipStatus.ACCEPTED;
    const saved = await this.friendshipRepository.save(friendship);

    const syncFriendsAchievements = async (uid: string) => {
      const friendsCount = await this.friendshipRepository.count({
        where: [
          { userId: uid, status: FriendshipStatus.ACCEPTED },
          { friendId: uid, status: FriendshipStatus.ACCEPTED },
        ],
      });

      await this.achievementsService.checkAndAwardByCondition(
        uid,
        'user.amigos',
        friendsCount,
      );
    };

    await syncFriendsAchievements(friendship.userId);
    await syncFriendsAchievements(friendship.friendId);
    
    const acceptor = await this.usersRepository.findOne({ where: { id: userId } });
    if (acceptor) {
      await this.notificationsService.sendToUser(
        friendship.userId,
        'Pedido Aceito! 🎉',
        `@${acceptor.nickname || acceptor.name} aceitou seu pedido de amizade.`,
        'user-check',
        'ALERT',
        { userId: userId },
      );
    }

    return saved;
  }


  /**
   * Rejeitar solicitação de amizade
   */
  async rejectFriendRequest(userId: string, friendshipId: string) {
    const friendship = await this.friendshipRepository.findOne({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    if (friendship.friendId !== userId) {
      throw new BadRequestException('Você não pode rejeitar esta solicitação');
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Esta solicitação já foi processada');
    }

    await this.friendshipRepository.remove(friendship);
    return { message: 'Solicitação rejeitada com sucesso' };
  }

  /**
   * Remover amigo
   */
  async removeFriend(userId: string, friendId: string) {
    const friendship = await this.friendshipRepository.findOne({
      where: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });

    if (!friendship) {
      throw new NotFoundException('Amizade não encontrada');
    }

    if (friendship.status !== FriendshipStatus.ACCEPTED) {
      throw new BadRequestException('Esta amizade não foi aceita');
    }

    await this.friendshipRepository.remove(friendship);
    return { message: 'Amizade removida com sucesso' };
  }

  /**
   * Listar amigos do usuário
   */
  async getFriends(userId: string, skip = 0, take = 20) {
    const [friendships, total] = await this.friendshipRepository.findAndCount({
      where: [
        { userId, status: FriendshipStatus.ACCEPTED },
        { friendId: userId, status: FriendshipStatus.ACCEPTED },
      ],
      relations: ['friend', 'user'],
      skip,
      take,
    });

    const friends = friendships.map((f) =>
      f.userId === userId ? f.friend : f.user,
    );

    return { data: friends, total, skip, take };
  }

  /**
   * Listar solicitações de amizade recebidas
   */
  async getFriendRequests(userId: string, skip = 0, take = 20) {
    const [friendships, total] = await this.friendshipRepository.findAndCount({
      where: { friendId: userId, status: FriendshipStatus.PENDING },
      relations: ['user'],
      skip,
      take,
      order: { createdAt: 'DESC' },
    });

    // Mapear para formato mais legível
    const requests = friendships.map((f) => ({
      id: f.id,
      fromUser: {
        id: f.user.id,
        name: f.user.name,
        nickname: f.user.nickname,
        avatarUrl: f.user.avatarUrl,
        city: f.user.city,
      },
      createdAt: f.createdAt,
    }));

    return { data: requests, total, skip, take };
  }

  /**
   * Listar pessoas disponíveis para adicionar (não amigos)
   */
  async getAvailableUsers(userId: string, skip = 0, take = 20) {
    // Busca todos os usuários
    const users = await this.usersRepository.find({
      skip,
      take,
    });

    // Filtra o usuário atual
    let availableUsers = users.filter((u) => u.id !== userId);

    // Busca todas as amizades do usuário
    const friendships = await this.friendshipRepository.find({
      where: [{ userId }, { friendId: userId }],
    });

    const friendIds = friendships.flatMap((f) => [f.userId, f.friendId]);

    // Filtra usuários que já são amigos ou possuem pedidos pendentes
    availableUsers = availableUsers.filter((u) => !friendIds.includes(u.id));

    const total = await this.usersRepository.count();
    return {
      data: availableUsers,
      total: total - 1 - friendIds.length,
      skip,
      take,
    };
  }

  /**
   * Verificar status de amizade entre dois usuários
   */
  async getFriendshipStatus(userId: string, targetUserId: string) {
    const friendship = await this.friendshipRepository.findOne({
      where: [
        { userId, friendId: targetUserId },
        { userId: targetUserId, friendId: userId },
      ],
    });

    if (!friendship) {
      return { status: 'NONE' };
    }

    return { status: friendship.status };
  }

  /**
   * Bloquear usuário
   */
  async blockUser(userId: string, targetUserId: string) {
    let friendship = await this.friendshipRepository.findOne({
      where: [
        { userId, friendId: targetUserId },
        { userId: targetUserId, friendId: userId },
      ],
    });

    if (!friendship) {
      friendship = this.friendshipRepository.create({
        userId,
        friendId: targetUserId,
        status: FriendshipStatus.BLOCKED,
      });
    } else {
      friendship.status = FriendshipStatus.BLOCKED;
    }

    return this.friendshipRepository.save(friendship);
  }
}
