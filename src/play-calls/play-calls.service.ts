import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, IsNull, Repository } from 'typeorm';
import { Game } from 'src/games/entities/game.entity';
import { GameUserMark } from 'src/games/entities/game-user-mark.entity';
import {
  Friendship,
  FriendshipStatus,
} from 'src/friends/entities/friendship.entity';
import { StoreVisit } from 'src/store-visits/entities/store-visit.entity';
import { StoreVisitsService } from 'src/store-visits/store-visits.service';
import { ChatsService } from 'src/chats/chats.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import {
  PlayCall,
  PlayCallMode,
  PlayCallStatus,
} from './entities/play-call.entity';
import { PlayCallMember } from './entities/play-call-member.entity';
import { CreatePlayCallDto } from './dto/play-call.dto';
import {
  MAX_OPEN_CALLS_PER_CREATOR,
  isExpired,
  statusForMembers,
} from './play-calls.rules';

const ACTIVE_STATUSES = [PlayCallStatus.OPEN, PlayCallStatus.FULL];

function publicUser(user: {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  };
}

import { assertAllowedContent } from 'src/common/content-filter';

@Injectable()
export class PlayCallsService {
  private readonly logger = new Logger(PlayCallsService.name);

  constructor(
    @InjectRepository(PlayCall)
    private callRepository: Repository<PlayCall>,
    @InjectRepository(PlayCallMember)
    private memberRepository: Repository<PlayCallMember>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameUserMark)
    private markRepository: Repository<GameUserMark>,
    @InjectRepository(Friendship)
    private friendshipRepository: Repository<Friendship>,
    @InjectRepository(StoreVisit)
    private visitRepository: Repository<StoreVisit>,
    private storeVisitsService: StoreVisitsService,
    private chatsService: ChatsService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  async list(viewerId: string, mode: PlayCallMode) {
    if (
      mode === PlayCallMode.NOW &&
      !(await this.storeVisitsService.hasOpenVisit(viewerId))
    ) {
      return [];
    }
    const [calls, blocked] = await Promise.all([
      this.callRepository.find({
        where: { mode, status: In(ACTIVE_STATUSES) },
        relations: { creator: true, game: true, members: { user: true } },
        order:
          mode === PlayCallMode.SCHEDULED
            ? { scheduledFor: 'ASC' }
            : { createdAt: 'DESC' },
      }),
      this.blockedUserIds(viewerId),
    ]);
    return calls
      .filter((call) => !this.involvesBlocked(call, blocked))
      .map((call) => this.present(call, viewerId));
  }

  async findOne(viewerId: string, id: string) {
    const call = await this.findCall(id);
    if (this.involvesBlocked(call, await this.blockedUserIds(viewerId))) {
      throw new NotFoundException('Chamado não encontrado.');
    }
    return this.present(call, viewerId);
  }

  async create(userId: string, dto: CreatePlayCallDto) {
    assertAllowedContent(dto.title, dto.note);
    if (
      dto.mode === PlayCallMode.NOW &&
      !(await this.storeVisitsService.hasOpenVisit(userId))
    ) {
      throw new BadRequestException(
        'Faça check-in na loja para procurar jogadores agora.',
      );
    }
    const scheduledFor =
      dto.mode === PlayCallMode.SCHEDULED && dto.scheduledFor
        ? new Date(dto.scheduledFor)
        : null;
    if (scheduledFor && scheduledFor.getTime() <= Date.now()) {
      throw new BadRequestException('Escolha um horário no futuro.');
    }

    const openCount = await this.callRepository.count({
      where: { creatorId: userId, status: In(ACTIVE_STATUSES) },
    });
    if (openCount >= MAX_OPEN_CALLS_PER_CREATOR) {
      throw new BadRequestException(
        `Você já tem ${MAX_OPEN_CALLS_PER_CREATOR} chamados abertos. Feche um antes de criar outro.`,
      );
    }

    const game = dto.gameId
      ? await this.gameRepository.findOne({ where: { id: dto.gameId } })
      : null;
    if (dto.gameId && !game)
      throw new NotFoundException('Jogo não encontrado.');

    const saved = await this.callRepository.save(
      this.callRepository.create({
        creatorId: userId,
        gameId: game?.id ?? null,
        title: dto.title?.trim() || game?.name || 'Partida',
        mode: dto.mode,
        scheduledFor,
        slotsNeeded: dto.slotsNeeded,
        note: dto.note?.trim() || null,
      }),
    );

    if (saved.mode === PlayCallMode.NOW && saved.gameId) {
      this.notifyInterestedPresent(saved).catch((error) =>
        this.logger.warn(
          `Falha ao avisar interessados: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
    this.announceChange();
    return this.findOne(userId, saved.id);
  }

  async join(userId: string, id: string) {
    const call = await this.findCall(id);
    if (call.creatorId === userId) {
      throw new BadRequestException('Você criou este chamado.');
    }
    if (call.members.some((m) => m.userId === userId)) {
      return this.present(call, userId);
    }
    if (call.status !== PlayCallStatus.OPEN) {
      throw new BadRequestException(
        'Esse chamado não está aceitando jogadores.',
      );
    }
    if (this.involvesBlocked(call, await this.blockedUserIds(userId))) {
      throw new ForbiddenException('Você não pode entrar neste chamado.');
    }
    if (
      call.mode === PlayCallMode.NOW &&
      !(await this.storeVisitsService.hasOpenVisit(userId))
    ) {
      throw new BadRequestException(
        'Faça check-in na loja para entrar neste chamado.',
      );
    }

    await this.memberRepository.manager.transaction(async (manager) => {
      await manager.findOne(PlayCall, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      const members = await manager.count(PlayCallMember, {
        where: { callId: id },
      });
      if (members >= call.slotsNeeded) {
        throw new BadRequestException('Esse chamado já lotou.');
      }
      await manager.save(
        manager.create(PlayCallMember, { callId: id, userId }),
      );
    });
    await this.syncStatus(call.id, call.slotsNeeded);
    await this.addToChat(call, userId);

    await this.notificationsService.sendToUser(
      call.creatorId,
      'Alguém topou jogar!',
      `Um jogador entrou no seu chamado "${call.title}".`,
      'users',
      'ALERT',
      { type: 'lfg', callId: call.id },
    );
    this.announceChange();
    return this.findOne(userId, id);
  }

  async leave(userId: string, id: string) {
    const call = await this.findCall(id);
    const result = await this.memberRepository.delete({ callId: id, userId });
    if (!result.affected) {
      throw new BadRequestException('Você não está neste chamado.');
    }
    if (ACTIVE_STATUSES.includes(call.status)) {
      await this.syncStatus(call.id, call.slotsNeeded);
    }
    if (call.chatId) {
      await this.chatsService.leaveChat(call.chatId, userId).catch(() => null);
    }
    this.announceChange();
    return { message: 'Você saiu do chamado.' };
  }

  async close(userId: string, id: string) {
    const call = await this.findCall(id);
    if (call.creatorId !== userId) {
      throw new ForbiddenException('Só quem criou pode encerrar o chamado.');
    }
    await this.callRepository.update(id, { status: PlayCallStatus.CLOSED });
    this.announceChange();
    return { message: 'Chamado encerrado.' };
  }

  @Cron('*/15 * * * *')
  async expireCalls(now: Date = new Date()) {
    const active = await this.callRepository.find({
      where: { status: In(ACTIVE_STATUSES) },
      select: {
        id: true,
        mode: true,
        createdAt: true,
        scheduledFor: true,
        creatorId: true,
      },
    });
    const creatorsInStore = await this.usersInStore(
      active.filter((c) => c.mode === PlayCallMode.NOW).map((c) => c.creatorId),
    );
    const expiredIds = active
      .filter((call) =>
        isExpired(call, now, creatorsInStore.has(call.creatorId)),
      )
      .map((call) => call.id);
    if (expiredIds.length === 0) return 0;

    await this.callRepository.update(
      { id: In(expiredIds) },
      { status: PlayCallStatus.EXPIRED },
    );
    this.announceChange();
    return expiredIds.length;
  }

  private async findCall(id: string) {
    const call = await this.callRepository.findOne({
      where: { id },
      relations: { creator: true, game: true, members: { user: true } },
    });
    if (!call) throw new NotFoundException('Chamado não encontrado.');
    return call;
  }

  private async syncStatus(id: string, slotsNeeded: number) {
    const members = await this.memberRepository.count({
      where: { callId: id },
    });
    await this.callRepository.update(
      { id, status: In(ACTIVE_STATUSES) },
      { status: statusForMembers(members, slotsNeeded) },
    );
  }

  private async addToChat(call: PlayCall, userId: string) {
    try {
      let chatId = call.chatId;
      if (!chatId) {
        const chat = await this.chatsService.createChat(call.creatorId, {
          name: call.title,
          description: call.note ?? undefined,
        });
        chatId = chat.id;
        await this.callRepository.update(call.id, { chatId });
      }
      await this.chatsService.addMembers(chatId, call.creatorId, {
        memberIds: [userId],
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao montar chat do chamado ${call.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async notifyInterestedPresent(call: PlayCall) {
    const marks = await this.markRepository.find({
      where: { gameId: call.gameId!, wantsToPlay: true },
      select: { userId: true },
    });
    const candidates = marks
      .map((m) => m.userId)
      .filter((id) => id !== call.creatorId);
    if (candidates.length === 0) return;

    const [present, blocked] = await Promise.all([
      this.usersInStore(candidates),
      this.blockedUserIds(call.creatorId),
    ]);
    const recipients = candidates.filter(
      (id) => present.has(id) && !blocked.has(id),
    );
    await this.notificationsService.sendToUsers(
      recipients,
      'Tem mesa procurando jogadores',
      `Estão procurando gente para jogar ${call.title} aqui na Mipo agora.`,
      'users',
      { type: 'lfg', callId: call.id },
    );
  }

  private async usersInStore(userIds: string[]) {
    if (userIds.length === 0) return new Set<string>();
    const visits = await this.visitRepository.find({
      where: { userId: In(userIds), checkedOutAt: IsNull() },
      select: { userId: true },
    });
    return new Set(visits.map((v) => v.userId));
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

  private involvesBlocked(call: PlayCall, blocked: Set<string>) {
    return (
      blocked.has(call.creatorId) ||
      call.members.some((member) => blocked.has(member.userId))
    );
  }

  private present(call: PlayCall, viewerId: string) {
    const isMember = call.members.some((m) => m.userId === viewerId);
    const isCreator = call.creatorId === viewerId;
    return {
      id: call.id,
      title: call.title,
      mode: call.mode,
      status: call.status,
      scheduledFor: call.scheduledFor,
      slotsNeeded: call.slotsNeeded,
      note: call.note,
      createdAt: call.createdAt,
      game: call.game
        ? {
            id: call.game.id,
            name: call.game.name,
            imageUrl: call.game.imageUrl,
          }
        : null,
      creator: publicUser(call.creator),
      members: call.members.map((m) => publicUser(m.user)),
      isCreator,
      isMember,
      chatId: isCreator || isMember ? call.chatId : null,
    };
  }

  private announceChange() {
    this.notificationsGateway.server?.emit('play-calls:changed');
  }
}
