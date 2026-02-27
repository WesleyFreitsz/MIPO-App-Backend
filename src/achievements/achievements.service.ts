import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { Achievement } from './entities/achievement.entity';
import { Rarity } from './entities/rarity.entity';
import { User } from 'src/users/entities/user.entity';
import { UserAchievement } from 'src/users/entities/user-achievement.entity';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(Achievement)
    private achievementsRepository: Repository<Achievement>,
    @InjectRepository(Rarity) private rarityRepository: Repository<Rarity>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private notificationsService: NotificationsService, // <-- ADICIONE AQUI
  ) {}

  async findAll(userId?: string) {
    const totalUsers = await this.userRepository.count();
    const achievements = await this.achievementsRepository.find({
      relations: ['rarity', 'linkedEvent'],
      order: { createdAt: 'DESC' },
    });

    const userAchievements = userId
      ? await this.userAchievementRepository.find({
          where: { user: { id: userId } },
          relations: ['achievement'],
        })
      : [];

    const userAchievementIds = userAchievements.map((ua) => ua.achievement.id);

    return Promise.all(
      achievements.map(async (ach) => {
        const ownersCount = await this.userAchievementRepository.count({
          where: { achievement: { id: ach.id } },
        });

        const userAchRecord = userAchievements.find(
          (ua) => ua.achievement.id === ach.id,
        );

        return {
          ...ach,
          obtainedPercentage:
            totalUsers > 0 ? (ownersCount / totalUsers) * 100 : 0,
          isObtained: userAchievementIds.includes(ach.id),
          isHighlighted: userAchRecord?.isHighlighted || false,
          acquiredAt: userAchRecord?.acquiredAt || null,
        };
      }),
    );
  }

  async checkAndAwardByCondition(
    userId: string,
    prefix: string,
    currentCount: number,
  ) {
    const potentialAchievements = await this.achievementsRepository.find({
      where: { condition: Like(`${prefix}.%`) },
    });

    for (const ach of potentialAchievements) {
      const parts = ach.condition?.split('.');
      const threshold = parseInt(parts?.[parts.length - 1] || '0', 10);

      if (currentCount >= threshold) {
        await this.awardToUsers([userId], ach.id);
      }
    }
  }

  // --- GESTÃO DE CONQUISTAS ---

  async create(dto: {
    title: string;
    icon: string;
    description?: string;
    condition?: string;
    rarityId?: string;
    eventId?: string;
  }) {
    const achievement = this.achievementsRepository.create({
      title: dto.title,
      icon: dto.icon,
      description: dto.description || null,
      condition: dto.condition || null, // AGORA SALVA A CONDIÇÃO
      rarity: dto.rarityId ? ({ id: dto.rarityId } as any) : null,
      linkedEvent: dto.eventId ? ({ id: dto.eventId } as any) : null,
    });
    return this.achievementsRepository.save(achievement);
  }

  async update(id: string, dto: any) {
    const ach = await this.achievementsRepository.findOne({ where: { id } });
    if (!ach) throw new NotFoundException('Conquista não encontrada.');

    // Converte os IDs de relação caso venham na edição
    if (dto.rarityId !== undefined)
      dto.rarity = dto.rarityId ? { id: dto.rarityId } : null;
    if (dto.eventId !== undefined)
      dto.linkedEvent = dto.eventId ? { id: dto.eventId } : null;

    Object.assign(ach, dto);
    return this.achievementsRepository.save(ach);
  }

  async remove(id: string) {
    const ach = await this.achievementsRepository.findOne({ where: { id } });
    if (!ach) throw new NotFoundException('Conquista não encontrada.');
    await this.achievementsRepository.remove(ach);
    return { message: 'Conquista deletada do sistema.' };
  }

  // --- ATRIBUIÇÃO E REMOÇÃO ---

  async awardToUsers(userIds: string[], achievementId: string) {
    const results: UserAchievement[] = [];

    // Busca os dados da conquista para mandar na notificação
    const achievement = await this.achievementsRepository.findOne({
      where: { id: achievementId },
    });

    if (!achievement) throw new NotFoundException('Conquista não encontrada.');

    for (const userId of userIds) {
      const existing = await this.userAchievementRepository.findOne({
        where: { user: { id: userId }, achievement: { id: achievementId } },
      });

      if (!existing) {
        const newAward = this.userAchievementRepository.create({
          user: { id: userId },
          achievement: { id: achievementId },
        });
        const saved = await this.userAchievementRepository.save(newAward);
        results.push(saved);

        // DISPARA A NOTIFICAÇÃO AQUI 👇
        try {
          await this.notificationsService.sendToUser(
            userId,
            'Nova Conquista Desbloqueada! 🏆',
            `Você acaba de ganhar a conquista: ${achievement.title}`,
            'award',
            'ALERT',
            { achievementId: achievement.id },
          );
        } catch (error) {
          console.error(
            `Falha ao notificar o usuário ${userId} sobre a conquista`,
            error,
          );
        }
      }
    }
    return results;
  }

  async removeAchievementFromUser(userId: string, achievementId: string) {
    const userAch = await this.userAchievementRepository.findOne({
      where: { user: { id: userId }, achievement: { id: achievementId } },
    });
    if (!userAch)
      throw new NotFoundException('O usuário não possui esta conquista.');
    await this.userAchievementRepository.remove(userAch);
    return { message: 'Conquista removida do usuário.' };
  }

  async setHighlights(userId: string, achievementIds: string[]) {
    if (achievementIds.length > 3)
      throw new ConflictException('Máximo de 3 destaques permitidos.');

    await this.userAchievementRepository.update(
      { user: { id: userId } },
      { isHighlighted: false },
    );

    if (achievementIds.length > 0) {
      await this.userAchievementRepository.update(
        { user: { id: userId }, achievement: { id: In(achievementIds) } },
        { isHighlighted: true },
      );
    }
    return { message: 'Destaques atualizados.' };
  }

  // --- GESTÃO DE RARIDADES ---

  async findAllRarities() {
    return this.rarityRepository.find({ order: { orderIndex: 'ASC' } });
  }

  async createRarity(name: string, color: string) {
    const count = await this.rarityRepository.count();
    const rarity = this.rarityRepository.create({
      name,
      color,
      orderIndex: count,
    });
    return this.rarityRepository.save(rarity);
  }

  async updateRarity(id: string, name: string, color: string) {
    const rarity = await this.rarityRepository.findOne({ where: { id } });
    if (!rarity) throw new NotFoundException('Raridade não encontrada.');
    if (name) rarity.name = name;
    if (color) rarity.color = color;
    return this.rarityRepository.save(rarity);
  }

  async removeRarity(id: string) {
    const rarity = await this.rarityRepository.findOne({ where: { id } });
    if (!rarity) throw new NotFoundException('Raridade não encontrada.');
    await this.rarityRepository.remove(rarity);
    return { message: 'Raridade removida' };
  }

  async updateRaritiesOrder(rarityIds: string[]) {
    for (let i = 0; i < rarityIds.length; i++) {
      await this.rarityRepository.update(rarityIds[i], { orderIndex: i });
    }
    return this.findAllRarities();
  }
}
