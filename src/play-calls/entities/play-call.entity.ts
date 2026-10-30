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
import { User } from 'src/users/entities/user.entity';
import { Game } from 'src/games/entities/game.entity';
import { PlayCallMember } from './play-call-member.entity';

export enum PlayCallMode {
  NOW = 'NOW',
  SCHEDULED = 'SCHEDULED',
}

export enum PlayCallStatus {
  OPEN = 'OPEN',
  FULL = 'FULL',
  CLOSED = 'CLOSED',
  EXPIRED = 'EXPIRED',
}

@Entity('play_calls')
@Index('IDX_play_calls_status_mode', ['status', 'mode'])
export class PlayCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  creatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column({ type: 'uuid', nullable: true })
  gameId: string | null;

  @ManyToOne(() => Game, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'gameId' })
  game: Game | null;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'enum', enum: PlayCallMode })
  mode: PlayCallMode;

  @Column({ type: 'timestamp', nullable: true })
  scheduledFor: Date | null;

  @Column({ type: 'int' })
  slotsNeeded: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({
    type: 'enum',
    enum: PlayCallStatus,
    default: PlayCallStatus.OPEN,
  })
  status: PlayCallStatus;

  @Column({ type: 'uuid', nullable: true })
  chatId: string | null;

  @OneToMany(() => PlayCallMember, (member) => member.call)
  members: PlayCallMember[];

  @CreateDateColumn()
  createdAt: Date;
}
