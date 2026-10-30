import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { StoreVisit } from 'src/store-visits/entities/store-visit.entity';

@Entity('visit_reviews')
@Check('"rating" BETWEEN 1 AND 5')
@Index('IDX_visit_reviews_createdAt', ['createdAt'])
export class VisitReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_visit_reviews_visit', { unique: true })
  @Column('uuid')
  visitId: string;

  @ManyToOne(() => StoreVisit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visitId' })
  visit: StoreVisit;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
