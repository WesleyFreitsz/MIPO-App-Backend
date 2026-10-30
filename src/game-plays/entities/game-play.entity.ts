import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Game } from 'src/games/entities/game.entity';
import { User } from 'src/users/entities/user.entity';
import { GamePlayPlayer } from './game-play-player.entity';

export enum GamePlaySource {
  ORDER = 'ORDER',
  MANUAL = 'MANUAL',
}

@Entity('game_plays')
@Index('IDX_game_plays_user_played', ['userId', 'playedAt'])
export class GamePlay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_game_plays_game')
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

  @Column({ type: 'timestamp' })
  playedAt: Date;

  @Column({ type: 'enum', enum: GamePlaySource })
  source: GamePlaySource;

  @Index('UQ_game_plays_order_item', { unique: true })
  @Column({ type: 'uuid', nullable: true })
  orderItemId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => GamePlayPlayer, (player) => player.play)
  players: GamePlayPlayer[];

  @CreateDateColumn()
  createdAt: Date;
}
