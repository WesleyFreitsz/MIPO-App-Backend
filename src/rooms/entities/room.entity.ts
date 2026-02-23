import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  game: string;

  @Column('uuid')
  organizerId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'organizerId' })
  organizer: User;

  @Column()
  date: string;

  @Column()
  time: string;

  @Column('int', { default: 4 })
  maxParticipants: number;

  @Column({ default: true })
  isPublic: boolean;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('uuid', { nullable: true })
  chatId: string | null;

  @Column('simple-array', { default: '' })
  participantIds: string[];

  @CreateDateColumn()
  createdAt: Date;
}
