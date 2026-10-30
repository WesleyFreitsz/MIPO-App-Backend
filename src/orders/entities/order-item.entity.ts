import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Game } from 'src/games/entities/game.entity';
import { MenuItem } from './menu-item.entity';
import { Order } from './order.entity';
import { numericTransformer } from './numeric.transformer';

export enum OrderItemKind {
  MENU = 'MENU',
  GAME = 'GAME',
  HELP = 'HELP',
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'enum', enum: OrderItemKind })
  kind: OrderItemKind;

  @Column({ type: 'uuid', nullable: true })
  menuItemId: string | null;

  @ManyToOne(() => MenuItem, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItem | null;

  @Column({ type: 'uuid', nullable: true })
  gameId: string | null;

  @ManyToOne(() => Game, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'gameId' })
  game: Game | null;

  @Column()
  nameSnapshot: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  unitPrice: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;
}
