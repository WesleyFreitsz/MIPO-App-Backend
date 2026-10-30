import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Game } from 'src/games/entities/game.entity';
import { User, UserRole } from 'src/users/entities/user.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { MonthlyGame } from './entities/monthly-game.entity';
import {
  MonthlyGameScore,
  MonthlyGameScoreStatus,
} from './entities/monthly-game-score.entity';
import {
  CreateMonthlyGameDto,
  ManualMonthlyGameScoreDto,
  MonthlyPeriodQueryDto,
  SubmitMonthlyGameScoreDto,
  UpdateMonthlyGameDto,
} from './dto/monthly-game.dto';
import { currentMonthlyPeriod, rankBestScores } from './monthly-games.ranking';

const MAX_GAMES_PER_MONTH = 3;
const PODIUM_SIZE = 3;

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  };
}

@Injectable()
export class MonthlyGamesService {
  constructor(
    @InjectRepository(MonthlyGame)
    private monthlyGameRepository: Repository<MonthlyGame>,
    @InjectRepository(MonthlyGameScore)
    private scoreRepository: Repository<MonthlyGameScore>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  // shortcut: ranking is computed in memory from every approved score of the game; move to a DISTINCT ON query if a month passes a few thousand scores.
  private async rankingsFor(monthlyGameIds: string[]) {
    const scores = monthlyGameIds.length
      ? await this.scoreRepository.find({
          where: {
            monthlyGameId: In(monthlyGameIds),
            status: MonthlyGameScoreStatus.APPROVED,
          },
          relations: { user: true },
        })
      : [];

    return new Map(
      monthlyGameIds.map((id) => [
        id,
        rankBestScores(
          scores.filter((score) => score.monthlyGameId === id),
        ).map((entry) => ({
          position: entry.position,
          score: entry.score,
          createdAt: entry.createdAt,
          user: publicUser(entry.user),
        })),
      ]),
    );
  }

  async getPeriod(userId: string, query: MonthlyPeriodQueryDto) {
    const current = currentMonthlyPeriod();
    const year = query.year ?? current.year;
    const month = query.month ?? current.month;

    const monthlyGames = await this.monthlyGameRepository.find({
      where: { year, month },
      order: { createdAt: 'ASC' },
    });
    const rankings = await this.rankingsFor(monthlyGames.map((mg) => mg.id));

    return {
      year,
      month,
      isCurrent: year === current.year && month === current.month,
      games: monthlyGames.map((monthlyGame) => {
        const ranking = rankings.get(monthlyGame.id) ?? [];
        return {
          ...monthlyGame,
          podium: ranking.slice(0, PODIUM_SIZE),
          totalPlayers: ranking.length,
          myEntry: ranking.find((entry) => entry.user.id === userId) ?? null,
        };
      }),
    };
  }

  async getRanking(monthlyGameId: string, skip: number, take: number) {
    await this.findMonthlyGame(monthlyGameId);
    const ranking = (await this.rankingsFor([monthlyGameId])).get(
      monthlyGameId,
    )!;
    return {
      data: ranking.slice(skip, skip + take),
      total: ranking.length,
      skip,
      take,
      hasMore: ranking.length > skip + take,
    };
  }

  async getHistory(skip: number, take: number) {
    const { year, month } = currentMonthlyPeriod();
    const [monthlyGames, total] = await this.monthlyGameRepository
      .createQueryBuilder('monthlyGame')
      .leftJoinAndSelect('monthlyGame.game', 'game')
      .where(
        'monthlyGame.year < :year OR (monthlyGame.year = :year AND monthlyGame.month < :month)',
        { year, month },
      )
      .orderBy('monthlyGame.year', 'DESC')
      .addOrderBy('monthlyGame.month', 'DESC')
      .addOrderBy('monthlyGame.createdAt', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    const rankings = await this.rankingsFor(monthlyGames.map((mg) => mg.id));

    return {
      data: monthlyGames.map((monthlyGame) => ({
        ...monthlyGame,
        podium: (rankings.get(monthlyGame.id) ?? []).slice(0, PODIUM_SIZE),
      })),
      total,
      skip,
      take,
      hasMore: total > skip + take,
    };
  }

  async create(dto: CreateMonthlyGameDto) {
    const game = await this.gameRepository.findOne({
      where: { id: dto.gameId },
    });
    if (!game) throw new NotFoundException('Jogo não encontrado.');

    const sameMonth = await this.monthlyGameRepository.find({
      where: { year: dto.year, month: dto.month },
      select: { id: true, gameId: true },
    });
    if (sameMonth.some((mg) => mg.gameId === dto.gameId)) {
      throw new BadRequestException('Esse jogo já está nos jogos deste mês.');
    }
    if (sameMonth.length >= MAX_GAMES_PER_MONTH) {
      throw new BadRequestException(
        `Cada mês pode ter no máximo ${MAX_GAMES_PER_MONTH} jogos.`,
      );
    }

    return this.monthlyGameRepository.save(
      this.monthlyGameRepository.create({
        year: dto.year,
        month: dto.month,
        gameId: dto.gameId,
        prizeFirst: dto.prizeFirst ?? null,
        prizeSecond: dto.prizeSecond ?? null,
        prizeThird: dto.prizeThird ?? null,
        rules: dto.rules ?? null,
      }),
    );
  }

  async update(id: string, dto: UpdateMonthlyGameDto) {
    const monthlyGame = await this.findMonthlyGame(id);
    Object.assign(monthlyGame, dto);
    return this.monthlyGameRepository.save(monthlyGame);
  }

  async remove(id: string) {
    const monthlyGame = await this.findMonthlyGame(id);
    await this.monthlyGameRepository.remove(monthlyGame);
    return { message: 'Jogo do mês removido.' };
  }

  async submitScore(
    userId: string,
    monthlyGameId: string,
    dto: SubmitMonthlyGameScoreDto,
  ) {
    const monthlyGame = await this.findMonthlyGame(monthlyGameId);
    const { year, month } = currentMonthlyPeriod();
    if (monthlyGame.year !== year || monthlyGame.month !== month) {
      throw new BadRequestException(
        'Só dá para enviar partidas dos jogos do mês atual.',
      );
    }

    const saved = await this.scoreRepository.save(
      this.scoreRepository.create({
        monthlyGameId,
        userId,
        score: dto.score,
        proofImageUrl: dto.proofImageUrl ?? null,
        note: dto.note ?? null,
        status: MonthlyGameScoreStatus.PENDING,
      }),
    );

    await this.notificationsService.notifyAdmins(
      'Nova partida para aprovar',
      `${monthlyGame.game.name}: ${dto.score} pontos aguardando aprovação.`,
      { type: 'monthly-game', scoreId: saved.id, pending: true },
      [UserRole.ADMIN, UserRole.MODERATOR],
    );
    return saved;
  }

  async registerManualScore(
    reviewerId: string,
    monthlyGameId: string,
    dto: ManualMonthlyGameScoreDto,
  ) {
    const monthlyGame = await this.findMonthlyGame(monthlyGameId);
    const player = await this.userRepository.findOne({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!player) throw new NotFoundException('Usuário não encontrado.');

    const saved = await this.scoreRepository.save(
      this.scoreRepository.create({
        monthlyGameId,
        userId: dto.userId,
        score: dto.score,
        note: dto.note ?? null,
        status: MonthlyGameScoreStatus.APPROVED,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      }),
    );

    await this.notificationsService.sendToUser(
      dto.userId,
      'Pontuação registrada!',
      `${dto.score} pontos em ${monthlyGame.game.name} entraram no ranking do mês.`,
      'check',
      'ALERT',
      { type: 'monthly-game', monthlyGameId },
    );
    return saved;
  }

  async getMyScores(userId: string, skip: number, take: number) {
    const [data, total] = await this.scoreRepository.findAndCount({
      where: { userId },
      relations: { monthlyGame: true },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { data, total, skip, take, hasMore: total > skip + take };
  }

  async getPendingScores(skip: number, take: number) {
    const [scores, total] = await this.scoreRepository.findAndCount({
      where: { status: MonthlyGameScoreStatus.PENDING },
      relations: { monthlyGame: true, user: true },
      order: { createdAt: 'ASC' },
      skip,
      take,
    });
    return {
      data: scores.map((score) => ({ ...score, user: publicUser(score.user) })),
      total,
      skip,
      take,
      hasMore: total > skip + take,
    };
  }

  async approveScore(scoreId: string, reviewerId: string) {
    const score = await this.findPendingScore(scoreId);
    score.status = MonthlyGameScoreStatus.APPROVED;
    score.reviewedById = reviewerId;
    score.reviewedAt = new Date();
    const saved = await this.scoreRepository.save(score);

    await this.notificationsService.sendToUser(
      score.userId,
      'Partida aprovada!',
      `Seus ${score.score} pontos em ${score.monthlyGame.game.name} já contam no ranking.`,
      'check',
      'ALERT',
      { type: 'monthly-game', monthlyGameId: score.monthlyGameId },
    );
    return saved;
  }

  async rejectScore(scoreId: string, reviewerId: string, reason: string) {
    const score = await this.findPendingScore(scoreId);
    score.status = MonthlyGameScoreStatus.REJECTED;
    score.rejectionReason = reason;
    score.reviewedById = reviewerId;
    score.reviewedAt = new Date();
    const saved = await this.scoreRepository.save(score);

    await this.notificationsService.sendToUser(
      score.userId,
      'Partida recusada',
      `Sua partida de ${score.monthlyGame.game.name} foi recusada: ${reason}`,
      'x-circle',
      'ALERT',
      { type: 'monthly-game', monthlyGameId: score.monthlyGameId },
    );
    return saved;
  }

  private async findMonthlyGame(id: string) {
    const monthlyGame = await this.monthlyGameRepository.findOne({
      where: { id },
    });
    if (!monthlyGame)
      throw new NotFoundException('Jogo do mês não encontrado.');
    return monthlyGame;
  }

  private async findPendingScore(id: string) {
    const score = await this.scoreRepository.findOne({
      where: { id },
      relations: { monthlyGame: true },
    });
    if (!score) throw new NotFoundException('Partida não encontrada.');
    if (score.status !== MonthlyGameScoreStatus.PENDING) {
      throw new BadRequestException('Essa partida já foi avaliada.');
    }
    return score;
  }
}
