import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Between, ILike, In, IsNull, Not, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { User } from 'src/users/entities/user.entity';
import {
  Friendship,
  FriendshipStatus,
} from 'src/friends/entities/friendship.entity';
import { AchievementsService } from 'src/achievements/achievements.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { NotificationsService } from 'src/notifications/notifications.service';
import { isUniqueViolation } from 'src/common/database-errors';
import { currentMonthlyPeriod } from 'src/monthly-games/monthly-games.ranking';
import { StoreVisit, StoreVisitSource } from './entities/store-visit.entity';
import { StoreCheckinCode } from './entities/store-checkin-code.entity';
import {
  aggregateVisitStats,
  storeMonthRange,
  visitStatsToCsv,
} from './store-visits.stats';
import { shouldAnnounceArrival } from './friend-arrival';

const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  nickname: true,
  avatarUrl: true,
} as const;

const STAFF_SEARCH_LIMIT = 30;

@Injectable()
export class StoreVisitsService {
  private readonly logger = new Logger(StoreVisitsService.name);

  constructor(
    @InjectRepository(StoreVisit)
    private visitRepository: Repository<StoreVisit>,
    @InjectRepository(StoreCheckinCode)
    private codeRepository: Repository<StoreCheckinCode>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Friendship)
    private friendshipRepository: Repository<Friendship>,
    private achievementsService: AchievementsService,
    private notificationsGateway: NotificationsGateway,
    private notificationsService: NotificationsService,
  ) {}

  async checkIn(userId: string, code: string) {
    const active = await this.codeRepository.findOne({
      where: { code, active: true },
      select: { id: true },
    });
    if (!active) {
      throw new BadRequestException(
        'QR code inválido ou expirado. Peça o código atual no balcão.',
      );
    }
    return this.openVisit(userId, StoreVisitSource.QR, null);
  }

  async staffCheckIn(staffId: string, userId: string) {
    const exists = await this.userRepository.exists({ where: { id: userId } });
    if (!exists) throw new NotFoundException('Usuário não encontrado.');
    return this.openVisit(userId, StoreVisitSource.STAFF, staffId);
  }

  async checkOutUser(userId: string) {
    const result = await this.visitRepository.update(
      { userId, checkedOutAt: IsNull() },
      { checkedOutAt: new Date() },
    );
    if (result.affected) this.announcePresenceChange();
    return { checkedOut: Boolean(result.affected) };
  }

  hasOpenVisit(userId: string): Promise<{ id: string } | null> {
    return this.visitRepository.findOne({
      where: { userId, checkedOutAt: IsNull() },
      select: { id: true },
    });
  }

  async getPresent(viewerId: string) {
    const [visits, blocked, mine] = await Promise.all([
      this.visitRepository.find({
        where: {
          checkedOutAt: IsNull(),
          user: { showInStorePresence: true, banned: false },
        },
        relations: { user: true },
        select: {
          id: true,
          userId: true,
          checkedInAt: true,
          user: PUBLIC_USER_FIELDS,
        },
        order: { checkedInAt: 'DESC' },
      }),
      this.blockedUserIds(viewerId),
      this.visitRepository.findOne({
        where: { userId: viewerId, checkedOutAt: IsNull() },
        select: { id: true, checkedInAt: true },
      }),
    ]);

    const users = visits
      .filter((visit) => !blocked.has(visit.userId))
      .map((visit) => visit.user);
    return {
      count: users.length,
      users,
      me: mine
        ? { checkedIn: true, visitId: mine.id, checkedInAt: mine.checkedInAt }
        : { checkedIn: false },
    };
  }

  async searchUsersForStaff(search?: string) {
    const term = search?.trim();
    if (!term) {
      const visits = await this.visitRepository.find({
        where: { checkedOutAt: IsNull() },
        relations: { user: true },
        select: { id: true, checkedInAt: true, user: PUBLIC_USER_FIELDS },
        order: { checkedInAt: 'DESC' },
      });
      return visits.map((visit) => ({
        ...visit.user,
        checkedIn: true,
        checkedInAt: visit.checkedInAt,
      }));
    }

    const users = await this.userRepository.find({
      where: [
        { name: ILike(`%${term}%`), banned: false },
        { nickname: ILike(`%${term}%`), banned: false },
      ],
      select: PUBLIC_USER_FIELDS,
      order: { name: 'ASC' },
      take: STAFF_SEARCH_LIMIT,
    });
    const open = users.length
      ? await this.visitRepository.find({
          where: { userId: In(users.map((u) => u.id)), checkedOutAt: IsNull() },
          select: { userId: true, checkedInAt: true },
        })
      : [];
    const openByUser = new Map(open.map((v) => [v.userId, v.checkedInAt]));
    return users.map((user) => ({
      ...user,
      checkedIn: openByUser.has(user.id),
      checkedInAt: openByUser.get(user.id) ?? null,
    }));
  }

  async getCode() {
    const active = await this.codeRepository.findOne({
      where: { active: true },
      order: { createdAt: 'DESC' },
    });
    return this.describeCode(active ?? (await this.createCode()));
  }

  async rotateCode() {
    await this.codeRepository.update({ active: true }, { active: false });
    return this.describeCode(await this.createCode());
  }

  async getStats(year?: number, month?: number) {
    const current = currentMonthlyPeriod();
    const period = {
      year: year ?? current.year,
      month: month ?? current.month,
    };
    const { from, to } = storeMonthRange(period.year, period.month);
    // shortcut: agrega em memória as visitas do mês; trocar por GROUP BY se passar de dezenas de milhares por mês.
    const visits = await this.visitRepository.find({
      where: { checkedInAt: Between(from, new Date(to.getTime() - 1)) },
      relations: { user: true },
      select: {
        id: true,
        userId: true,
        checkedInAt: true,
        checkedOutAt: true,
        user: PUBLIC_USER_FIELDS,
      },
    });
    return { ...period, ...aggregateVisitStats(visits) };
  }

  async exportStatsCsv(year?: number, month?: number) {
    const stats = await this.getStats(year, month);
    return visitStatsToCsv(stats.ranking);
  }

  @Cron('0 4 * * *', { timeZone: 'America/Sao_Paulo' })
  async closeForgottenVisits() {
    const result = await this.visitRepository.update(
      { checkedOutAt: IsNull() },
      { checkedOutAt: new Date() },
    );
    if (result.affected) {
      this.logger.log(`${result.affected} visitas encerradas automaticamente`);
      this.announcePresenceChange();
    }
  }

  private async openVisit(
    userId: string,
    source: StoreVisitSource,
    checkedInById: string | null,
  ) {
    const existing = await this.visitRepository.findOne({
      where: { userId, checkedOutAt: IsNull() },
    });
    if (existing) return existing;

    let visit: StoreVisit;
    try {
      visit = await this.visitRepository.save(
        this.visitRepository.create({
          userId,
          source,
          checkedInById,
          // Gravado pelo Node, como o checkedOutAt, para os dois usarem o mesmo relógio/fuso.
          checkedInAt: new Date(),
        }),
      );
    } catch (error) {
      const raced = isUniqueViolation(error)
        ? await this.visitRepository.findOne({
            where: { userId, checkedOutAt: IsNull() },
          })
        : null;
      if (!raced) throw error;
      return raced;
    }

    this.announcePresenceChange();
    await this.awardVisitAchievements(userId);
    this.notifyFriendsOfArrival(userId, visit.id).catch((error: unknown) =>
      this.logger.warn(`Falha ao avisar amigos: ${String(error)}`),
    );
    return visit;
  }

  private async awardVisitAchievements(userId: string) {
    try {
      const total = await this.visitRepository.count({ where: { userId } });
      await this.achievementsService.checkAndAwardByCondition(
        userId,
        'loja.visitas',
        total,
      );
    } catch (error) {
      this.logger.warn(
        `Falha ao verificar conquistas de visita: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async notifyFriendsOfArrival(userId: string, visitId: string) {
    const [user, previousVisit] = await Promise.all([
      this.userRepository.findOne({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          nickname: true,
          showInStorePresence: true,
        },
      }),
      this.visitRepository.findOne({
        where: { userId, id: Not(visitId) },
        select: { checkedInAt: true },
        order: { checkedInAt: 'DESC' },
      }),
    ]);
    if (!user?.showInStorePresence) return;
    if (!shouldAnnounceArrival(previousVisit?.checkedInAt)) return;

    const [friendships, blocked] = await Promise.all([
      this.friendshipRepository.find({
        where: [
          { userId, status: FriendshipStatus.ACCEPTED },
          { friendId: userId, status: FriendshipStatus.ACCEPTED },
        ],
        select: { userId: true, friendId: true },
      }),
      this.blockedUserIds(userId),
    ]);
    const friendIds = friendships
      .map((row) => (row.userId === userId ? row.friendId : row.userId))
      .filter((id) => !blocked.has(id));
    if (friendIds.length === 0) return;

    const name = user.nickname || user.name;
    await this.notificationsService.sendToUsers(
      friendIds,
      `${name} chegou na Mipo!`,
      'Bora jogar junto? Veja quem está na loja agora.',
      'map-pin',
      { type: 'friend-arrived', friendUserId: userId },
    );
  }

  private async blockedUserIds(viewerId: string) {
    const rows = await this.friendshipRepository.find({
      where: [
        { userId: viewerId, status: FriendshipStatus.BLOCKED },
        { friendId: viewerId, status: FriendshipStatus.BLOCKED },
      ],
      select: { userId: true, friendId: true },
    });
    return new Set(
      rows.map((row) => (row.userId === viewerId ? row.friendId : row.userId)),
    );
  }

  private createCode() {
    return this.codeRepository.save(
      this.codeRepository.create({
        code: randomBytes(12).toString('base64url'),
        active: true,
      }),
    );
  }

  private describeCode(code: StoreCheckinCode) {
    return {
      code: code.code,
      qrContent: `mipo://checkin/${code.code}`,
      createdAt: code.createdAt,
    };
  }

  private announcePresenceChange() {
    this.notificationsGateway.server?.emit('store:presence-changed');
  }
}
