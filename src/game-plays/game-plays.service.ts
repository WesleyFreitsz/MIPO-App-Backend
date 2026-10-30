import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Game } from 'src/games/entities/game.entity';
import { GameUserMark } from 'src/games/entities/game-user-mark.entity';
import {
  Friendship,
  FriendshipStatus,
} from 'src/friends/entities/friendship.entity';
import { User } from 'src/users/entities/user.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { currentMonthlyPeriod } from 'src/monthly-games/monthly-games.ranking';
import { GamePlay, GamePlaySource } from './entities/game-play.entity';
import { GamePlayPlayer } from './entities/game-play-player.entity';
import { CreateGamePlayDto } from './dto/game-play.dto';
import { recommendGames } from './recommendations';

const FRIENDS_RECENT_DAYS = 30;
const TOP_GAMES = 3;

// Partidas em que a pessoa aparece, seja como autora ou como jogadora marcada.
const PARTICIPATIONS_SQL = `
  SELECT gp."gameId", gp."userId" AS "participantId", gp."playedAt"
  FROM game_plays gp
  UNION ALL
  SELECT gp."gameId", gpp."userId" AS "participantId", gp."playedAt"
  FROM game_play_players gpp
  JOIN game_plays gp ON gp.id = gpp."playId"
`;

interface OrderItemPlay {
  orderItemId: string;
  gameId: string;
  userId: string;
  playedAt: Date;
}

function publicUser(user: User | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  };
}

@Injectable()
export class GamePlaysService {
  constructor(
    @InjectRepository(GamePlay)
    private playRepository: Repository<GamePlay>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameUserMark)
    private markRepository: Repository<GameUserMark>,
    @InjectRepository(Friendship)
    private friendshipRepository: Repository<Friendship>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async recordFromOrderItem(play: OrderItemPlay) {
    await this.playRepository
      .createQueryBuilder()
      .insert()
      .values({
        orderItemId: play.orderItemId,
        gameId: play.gameId,
        userId: play.userId,
        playedAt: play.playedAt,
        source: GamePlaySource.ORDER,
      })
      .orIgnore()
      .execute();
  }

  async recordManual(authorId: string, gameId: string, dto: CreateGamePlayDto) {
    const game = await this.gameRepository.findOne({
      where: { id: gameId, active: true },
      select: { id: true, name: true },
    });
    if (!game) throw new NotFoundException('Jogo não encontrado.');

    const playerIds = (dto.playerIds ?? []).filter((id) => id !== authorId);
    const friendIds = await this.friendIds(authorId);
    if (playerIds.some((id) => !friendIds.has(id))) {
      throw new BadRequestException(
        'Você só pode marcar amigos que jogaram com você.',
      );
    }
    const playedAt = dto.playedAt ? new Date(dto.playedAt) : new Date();
    if (playedAt.getTime() > Date.now()) {
      throw new BadRequestException('A partida não pode estar no futuro.');
    }

    const play = await this.playRepository.manager.transaction(
      async (manager) => {
        const saved = await manager.save(
          manager.create(GamePlay, {
            gameId,
            userId: authorId,
            playedAt,
            source: GamePlaySource.MANUAL,
            note: dto.note ?? null,
          }),
        );
        if (playerIds.length > 0) {
          await manager.insert(
            GamePlayPlayer,
            playerIds.map((userId) => ({ playId: saved.id, userId })),
          );
        }
        return saved;
      },
    );

    if (playerIds.length > 0) {
      const author = await this.userRepository.findOne({
        where: { id: authorId },
        select: { id: true, name: true, nickname: true },
      });
      await this.notificationsService.sendToUsers(
        playerIds,
        'Partida registrada',
        `${author?.nickname || author?.name || 'Um amigo'} registrou uma partida de ${game.name} com você.`,
        'check',
        { type: 'friend', userId: authorId },
      );
    }
    return play;
  }

  async listForUser(
    viewerId: string,
    targetId: string,
    skip: number,
    take: number,
  ) {
    if (viewerId !== targetId && (await this.isBlocked(viewerId, targetId))) {
      throw new ForbiddenException('Histórico indisponível.');
    }

    const [plays, total] = await this.playRepository
      .createQueryBuilder('play')
      .leftJoinAndSelect('play.game', 'game')
      .leftJoinAndSelect('play.user', 'author')
      .leftJoinAndSelect('play.players', 'player')
      .leftJoinAndSelect('player.user', 'playerUser')
      .where(
        'play.userId = :targetId OR play.id IN (SELECT gpp."playId" FROM game_play_players gpp WHERE gpp."userId" = :targetId)',
        { targetId },
      )
      .orderBy('play.playedAt', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return {
      data: plays.map((play) => ({
        id: play.id,
        playedAt: play.playedAt,
        source: play.source,
        note: play.note,
        game: {
          id: play.game.id,
          name: play.game.name,
          imageUrl: play.game.imageUrl,
        },
        author: publicUser(play.user),
        players: play.players.map((player) => publicUser(player.user)),
      })),
      total,
      skip,
      take,
      hasMore: total > skip + take,
      summary: await this.summaryFor(targetId),
    };
  }

  async recommendationsFor(userId: string) {
    const friendIds = [...(await this.friendIds(userId))];
    const [games, myCounts, friendCounts, marks, ratings] = await Promise.all([
      this.gameRepository.find({
        where: { active: true },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          category: true,
          isFeatured: true,
        },
      }),
      this.playRepository.query<{ gameId: string; count: string }[]>(
        `SELECT "gameId", COUNT(*) AS count FROM (${PARTICIPATIONS_SQL}) p
         WHERE p."participantId" = $1 GROUP BY "gameId"`,
        [userId],
      ),
      friendIds.length
        ? this.playRepository.query<{ gameId: string; count: string }[]>(
            `SELECT "gameId", COUNT(DISTINCT "participantId") AS count FROM (${PARTICIPATIONS_SQL}) p
             WHERE p."participantId" = ANY($1::uuid[])
               AND p."playedAt" > now() - make_interval(days => $2)
             GROUP BY "gameId"`,
            [friendIds, FRIENDS_RECENT_DAYS],
          )
        : Promise.resolve([]),
      this.markRepository.find({
        where: { userId },
        select: { gameId: true, isFavorite: true, wantsToPlay: true },
      }),
      this.markRepository
        .createQueryBuilder('mark')
        .select('mark.gameId', 'gameId')
        .addSelect('AVG(mark.rating)', 'average')
        .addSelect('COUNT(mark.rating)', 'count')
        .where('mark.rating IS NOT NULL')
        .groupBy('mark.gameId')
        .getRawMany<{ gameId: string; average: string; count: string }>(),
    ]);

    return recommendGames({
      games,
      myPlayCounts: new Map(myCounts.map((r) => [r.gameId, Number(r.count)])),
      friendPlayers: new Map(
        friendCounts.map((r) => [r.gameId, Number(r.count)]),
      ),
      favoriteIds: new Set(
        marks.filter((m) => m.isFavorite).map((m) => m.gameId),
      ),
      wantsToPlayIds: new Set(
        marks.filter((m) => m.wantsToPlay).map((m) => m.gameId),
      ),
      ratings: new Map(
        ratings.map((r) => [
          r.gameId,
          { average: Number(r.average), count: Number(r.count) },
        ]),
      ),
    });
  }

  private async summaryFor(userId: string) {
    const rows = await this.playRepository.query<
      { gameId: string; playedAt: Date }[]
    >(
      `SELECT "gameId", "playedAt" FROM (${PARTICIPATIONS_SQL}) p WHERE p."participantId" = $1`,
      [userId],
    );
    const { year, month } = currentMonthlyPeriod();
    const playsThisMonth = rows.filter((row) => {
      const period = currentMonthlyPeriod(new Date(row.playedAt));
      return period.year === year && period.month === month;
    }).length;

    const counts = new Map<string, number>();
    rows.forEach((row) =>
      counts.set(row.gameId, (counts.get(row.gameId) ?? 0) + 1),
    );
    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_GAMES);
    const topGames = topIds.length
      ? await this.gameRepository.find({
          where: { id: In(topIds.map(([id]) => id)) },
          select: { id: true, name: true, imageUrl: true },
        })
      : [];

    return {
      totalPlays: rows.length,
      distinctGames: counts.size,
      playsThisMonth,
      topGames: topIds.flatMap(([id, plays]) => {
        const game = topGames.find((g) => g.id === id);
        return game ? [{ ...game, plays }] : [];
      }),
    };
  }

  private async friendIds(userId: string) {
    const rows = await this.friendshipRepository.find({
      where: [
        { userId, status: FriendshipStatus.ACCEPTED },
        { friendId: userId, status: FriendshipStatus.ACCEPTED },
      ],
      select: { userId: true, friendId: true },
    });
    return new Set(
      rows.map((row) => (row.userId === userId ? row.friendId : row.userId)),
    );
  }

  private isBlocked(userId: string, otherId: string) {
    return this.friendshipRepository.exists({
      where: [
        { userId, friendId: otherId, status: FriendshipStatus.BLOCKED },
        { userId: otherId, friendId: userId, status: FriendshipStatus.BLOCKED },
      ],
    });
  }
}
