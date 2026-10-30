import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

export enum StoreVisitSource {
  QR = 'QR',
  STAFF = 'STAFF',
}

@Entity('store_visits')
@Index('UQ_store_visits_open_user', ['userId'], {
  unique: true,
  where: '"checkedOutAt" IS NULL',
})
@Index('IDX_store_visits_checkedInAt', ['checkedInAt'])
export class StoreVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'timestamp', default: () => 'now()' })
  checkedInAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkedOutAt: Date | null;

  @Column({
    type: 'enum',
    enum: StoreVisitSource,
    default: StoreVisitSource.QR,
  })
  source: StoreVisitSource;

  @Column({ type: 'uuid', nullable: true })
  checkedInById: string | null;
}
