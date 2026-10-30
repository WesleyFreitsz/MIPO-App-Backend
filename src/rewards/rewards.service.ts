import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Reward } from './entities/reward.entity';
import {
  RedemptionStatus,
  RewardRedemption,
} from './entities/reward-redemption.entity';
import { User } from 'src/users/entities/user.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { CreateRewardDto, UpdateRewardDto } from './dto/reward.dto';

@Injectable()
export class RewardsService {
  constructor(
    @InjectRepository(Reward)
    private rewardsRepository: Repository<Reward>,
    @InjectRepository(RewardRedemption)
    private redemptionsRepository: Repository<RewardRedemption>,
    private notificationsService: NotificationsService,
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

  async redeem(userId: string, rewardId: string) {
    const redemption = await this.rewardsRepository.manager.transaction(
      async (manager) => {
        const reward = await manager.findOne(Reward, {
          where: { id: rewardId },
        });
        if (!reward) throw new NotFoundException('Recompensa não encontrada.');

        // Updates condicionais evitam saldo/estoque negativo em resgates simultâneos.
        const stock = await manager.decrement(
          Reward,
          { id: rewardId, stock: MoreThan(0) },
          'stock',
          1,
        );
        if (!stock.affected) {
          throw new BadRequestException('Recompensa esgotada.');
        }

        const coins = await manager.decrement(
          User,
          { id: userId, coins: MoreThanOrEqual(reward.price) },
          'coins',
          reward.price,
        );
        if (!coins.affected) {
          throw new BadRequestException('Moedas insuficientes.');
        }

        return manager.save(
          manager.create(RewardRedemption, {
            userId,
            rewardId,
            rewardTitle: reward.title,
            price: reward.price,
          }),
        );
      },
    );

    await this.notificationsService.notifyAdmins(
      'Novo resgate de recompensa',
      `Um jogador resgatou "${redemption.rewardTitle}".`,
      { type: 'REWARD_REDEMPTION', redemptionId: redemption.id },
    );
    return redemption;
  }

  async findMyRedemptions(userId: string) {
    return this.redemptionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findRedemptions(status?: RedemptionStatus) {
    return this.redemptionsRepository.find({
      where: status ? { status } : undefined,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async markDelivered(id: string) {
    const redemption = await this.redemptionsRepository.findOne({
      where: { id },
    });
    if (!redemption) throw new NotFoundException('Resgate não encontrado.');
    if (redemption.status === RedemptionStatus.DELIVERED) return redemption;

    redemption.status = RedemptionStatus.DELIVERED;
    redemption.deliveredAt = new Date();
    const saved = await this.redemptionsRepository.save(redemption);
    await this.notificationsService.sendToUser(
      redemption.userId,
      'Recompensa entregue',
      `"${redemption.rewardTitle}" foi marcada como entregue.`,
      'gift',
      'ALERT',
      { type: 'REWARD_REDEMPTION', redemptionId: redemption.id },
    );
    return saved;
  }
}
