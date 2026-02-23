import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('finance_transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  value: number;

  @Column('varchar', { length: 10 })
  type: 'in' | 'out';

  @CreateDateColumn()
  createdAt: Date;
}
