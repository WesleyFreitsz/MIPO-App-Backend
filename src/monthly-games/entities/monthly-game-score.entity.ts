import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { MonthlyGame } from './monthly-game.entity';

export enum MonthlyGameScoreStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('monthly_game_scores')
@Index(['monthlyGameId', 'status'])
export class MonthlyGameScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  monthlyGameId: string;

  @ManyToOne(() => MonthlyGame, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'monthlyGameId' })
  monthlyGame: MonthlyGame;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  score: number;

  @Column({ type: 'varchar', nullable: true })
  proofImageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    type: 'enum',
    enum: MonthlyGameScoreStatus,
    default: MonthlyGameScoreStatus.PENDING,
  })
  status: MonthlyGameScoreStatus;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
