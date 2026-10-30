import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('notification_preferences')
@Unique(['userId', 'type'])
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 30 })
  type: string;

  @Column({ default: true })
  enabled: boolean;
}
