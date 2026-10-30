import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderTab } from './order-tab.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  DONE = 'DONE',
  CANCELED = 'CANCELED',
}

@Entity('orders')
@Index('IDX_orders_status_createdAt', ['status', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_orders_tabId')
  @Column('uuid')
  tabId: string;

  @ManyToOne(() => OrderTab, (tab) => tab.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tabId' })
  tab: OrderTab;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  tableLabel: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  handledById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  doneAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  canceledReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: ['insert'] })
  items: OrderItem[];
}
