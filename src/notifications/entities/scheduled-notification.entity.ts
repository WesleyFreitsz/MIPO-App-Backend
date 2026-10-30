import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('scheduled_notifications')
export class ScheduledNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ type: 'varchar', nullable: true })
  icon: string | null;

  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  @Column('timestamp')
  sendAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
