import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Reward } from './reward.entity';

export enum RedemptionStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
}

@Entity('reward_redemptions')
export class RewardRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'uuid', nullable: true })
  rewardId: string | null;

  @ManyToOne(() => Reward, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rewardId' })
  reward?: Reward | null;

  // Cópia do título e preço: a recompensa pode ser editada ou apagada depois.
  @Column()
  rewardTitle: string;

  @Column('int')
  price: number;

  @Column({
    type: 'enum',
    enum: RedemptionStatus,
    default: RedemptionStatus.PENDING,
  })
  status: RedemptionStatus;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
