import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Order } from './order.entity';

export enum OrderTabStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

@Entity('order_tabs')
@Index('UQ_order_tabs_open_user', ['userId'], {
  unique: true,
  where: `"status" = 'OPEN'`,
})
@Index('UQ_order_tabs_open_card', ['cardNumber'], {
  unique: true,
  where: `"status" = 'OPEN'`,
})
export class OrderTab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 80 })
  customerName: string;

  @Column({ length: 20 })
  cardNumber: string;

  @Column({ type: 'uuid', nullable: true })
  visitId: string | null;

  @Column({ type: 'enum', enum: OrderTabStatus, default: OrderTabStatus.OPEN })
  status: OrderTabStatus;

  @CreateDateColumn()
  openedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  closedById: string | null;

  @OneToMany(() => Order, (order) => order.tab)
  orders: Order[];
}
