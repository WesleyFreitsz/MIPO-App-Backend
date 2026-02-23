import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement } from './entities/achievement.entity';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(Achievement)
    private achievementsRepository: Repository<Achievement>,
  ) {}

  async findAll() {
    return this.achievementsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: { title: string; icon?: string }) {
    const achievement = this.achievementsRepository.create({
      title: dto.title,
      icon: dto.icon || '🏆',
    });
    return this.achievementsRepository.save(achievement);
  }

  async remove(id: string) {
    const achievement = await this.achievementsRepository.findOne({
      where: { id },
    });
    if (!achievement) throw new NotFoundException('Conquista não encontrada.');
    await this.achievementsRepository.remove(achievement);
    return { message: 'Conquista excluída.' };
  }
}
