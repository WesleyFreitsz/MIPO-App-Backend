import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

export enum ReservationApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('salinha_reservations')
export class SalinhaReservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  date: string;

  @Column('time')
  startTime: string;

  @Column('time')
  endTime: string;

  @Column('decimal', { precision: 10, scale: 2 })
  totalPrice: number;

  @Column('enum', {
    enum: ReservationApprovalStatus,
    default: ReservationApprovalStatus.PENDING,
  })
  status: ReservationApprovalStatus;

  @Column({ nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  approvedAt: Date | null;
}
