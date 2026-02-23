import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

export enum RoomType {
  SALINHA = 'salinha',
  SALAO_INTERNO = 'salao_interno',
  SALAO_EXTERNO = 'salao_externo',
}

export enum ReservationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  CANCELLED = 'cancelled',
}

export interface RoomParticipant {
  userId: string;
  name: string;
  activity?: string | null;
  activityType?: 'game' | 'custom' | null;
  isActivityPublic?: boolean; // true = outros podem se juntar, false = apenas admins veem
  startTime: string;
  endTime: string;
  joinedAt: Date;
}

@Entity('rooms')
export class Room {
  @PrimaryColumn('uuid')
  id: string;

  @Column('enum', { enum: RoomType, default: RoomType.SALAO_INTERNO })
  type: RoomType;

  @Column('uuid', { nullable: true })
  organizerId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'organizerId' })
  organizer: User | null;

  @Column({ default: () => 'CURRENT_DATE' })
  date: string;

  @Column({ default: '10:00' })
  startTime: string;

  @Column({ default: '12:00' })
  endTime: string;

  @Column('text', { nullable: true })
  activity: string | null;

  @Column('varchar', { nullable: true, default: null })
  activityType: 'game' | 'custom' | null;

  @Column('simple-json', { default: '[]' })
  participants: RoomParticipant[];

  @Column('enum', {
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  reservationStatus: ReservationStatus;

  @Column('uuid', { nullable: true })
  chatId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
