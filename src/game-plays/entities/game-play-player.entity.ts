import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { GamePlay } from './game-play.entity';

@Entity('game_play_players')
export class GamePlayPlayer {
  @PrimaryColumn('uuid')
  playId: string;

  @ManyToOne(() => GamePlay, (play) => play.players, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playId' })
  play: GamePlay;

  @Index('IDX_game_play_players_user')
  @PrimaryColumn('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
