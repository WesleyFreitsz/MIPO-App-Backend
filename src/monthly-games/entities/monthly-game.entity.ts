import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Game } from 'src/games/entities/game.entity';

@Entity('monthly_games')
@Unique(['year', 'month', 'gameId'])
export class MonthlyGame {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  @Column('uuid')
  gameId: string;

  @ManyToOne(() => Game, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @Column({ type: 'varchar', nullable: true })
  prizeFirst: string | null;

  @Column({ type: 'varchar', nullable: true })
  prizeSecond: string | null;

  @Column({ type: 'varchar', nullable: true })
  prizeThird: string | null;

  @Column({ type: 'text', nullable: true })
  rules: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
