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
import { Order } from 'src/orders/entities/order.entity';

@Entity('order_reviews')
@Check('"rating" BETWEEN 1 AND 5')
export class OrderReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_order_reviews_order', { unique: true })
  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  rating: number;

  @CreateDateColumn()
  createdAt: Date;
}
