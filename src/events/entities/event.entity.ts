import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

export enum EventSpace {
  EXTERNO = 'EXTERNO',
  SALAO = 'SALAO',
  SALINHA = 'SALINHA',
  PERSONALIZADO = 'PERSONALIZADO',
}

export enum EventStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REPROVED = 'REPROVED',
  CONCLUDED = 'CONCLUDED', // <--- NOVO STATUS
}

@Entity()
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ type: 'enum', enum: EventSpace })
  space: EventSpace;

  @Column({ nullable: true })
  customLocation: string;

  @Column({ nullable: true })
  bannerUrl: string;

  @Column('timestamp')
  dateTime: Date;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PENDING })
  status: EventStatus;

  @Column({ nullable: true })
  rejectionReason: string;

  @ManyToOne(() => User)
  creator: User;

  @ManyToMany(() => User)
  @JoinTable()
  participants: User[];

  @Column({ type: 'simple-array', nullable: true })
  checkedInUserIds: string[];

  @CreateDateColumn()
  createdAt: Date;
}
