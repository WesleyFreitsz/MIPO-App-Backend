import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from './numeric.transformer';

export enum MenuCategory {
  FOOD = 'FOOD',
  DRINK = 'DRINK',
  DESSERT = 'DESSERT',
  OTHER = 'OTHER',
}

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: MenuCategory, default: MenuCategory.FOOD })
  category: MenuCategory;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  price: number;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ default: true })
  available: boolean;

  @Column({ default: false })
  dailySpecial: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
