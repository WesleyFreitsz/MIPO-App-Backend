import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Achievement } from 'src/achievements/entities/achievement.entity';

@Entity('user_achievements')
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @ManyToOne(() => Achievement, { onDelete: 'CASCADE' })
  @JoinColumn()
  achievement: Achievement;

  @CreateDateColumn()
  acquiredAt: Date;

  @Column({ default: false })
  isHighlighted: boolean; // Para o destaque de 3 conquistas
}
