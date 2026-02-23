import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reward } from './entities/reward.entity';

@Injectable()
export class RewardsService {
  constructor(
    @InjectRepository(Reward)
    private rewardsRepository: Repository<Reward>,
  ) {}

  async findAll() {
    return this.rewardsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: { title: string; price: number; stock: number }) {
    const reward = this.rewardsRepository.create(dto);
    return this.rewardsRepository.save(reward);
  }

  async update(id: string, dto: Partial<{ title: string; price: number; stock: number }>) {
    const reward = await this.rewardsRepository.findOne({ where: { id } });
    if (!reward) throw new NotFoundException('Recompensa não encontrada.');
    Object.assign(reward, dto);
    return this.rewardsRepository.save(reward);
  }

  async remove(id: string) {
    const reward = await this.rewardsRepository.findOne({ where: { id } });
    if (!reward) throw new NotFoundException('Recompensa não encontrada.');
    await this.rewardsRepository.remove(reward);
    return { message: 'Recompensa excluída.' };
  }
}
