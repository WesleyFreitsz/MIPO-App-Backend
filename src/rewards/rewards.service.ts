import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reward } from './entities/reward.entity';
import { CreateRewardDto, UpdateRewardDto } from './dto/reward.dto';

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

  async create(dto: CreateRewardDto) {
    const reward = this.rewardsRepository.create({
      title: dto.title,
      price: dto.price,
      stock: dto.stock,
    });
    return this.rewardsRepository.save(reward);
  }

  async update(id: string, dto: UpdateRewardDto) {
    const reward = await this.rewardsRepository.findOne({ where: { id } });
    if (!reward) throw new NotFoundException('Recompensa não encontrada.');
    if (dto.title !== undefined) reward.title = dto.title;
    if (dto.price !== undefined) reward.price = dto.price;
    if (dto.stock !== undefined) reward.stock = dto.stock;
    return this.rewardsRepository.save(reward);
  }

  async remove(id: string) {
    const reward = await this.rewardsRepository.findOne({ where: { id } });
    if (!reward) throw new NotFoundException('Recompensa não encontrada.');
    await this.rewardsRepository.remove(reward);
    return { message: 'Recompensa excluída.' };
  }
}
