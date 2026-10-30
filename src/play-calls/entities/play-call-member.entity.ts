import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { PlayCall } from './play-call.entity';

@Entity('play_call_members')
export class PlayCallMember {
  @PrimaryColumn('uuid')
  callId: string;

  @PrimaryColumn('uuid')
  userId: string;

  @ManyToOne(() => PlayCall, (call) => call.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'callId' })
  call: PlayCall;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  joinedAt: Date;
}
