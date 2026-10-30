import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Game } from './game.entity';

@Entity('game_user_marks')
@Unique(['gameId', 'userId'])
export class GameUserMark {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  gameId: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: false })
  isFavorite: boolean;

  @Column({ default: false })
  wantsToPlay: boolean;

  @Column({ type: 'int', nullable: true })
  rating: number | null;

  @Column({ type: 'text', nullable: true })
  review: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
