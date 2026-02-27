import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Rarity } from './rarity.entity';
import { Event } from 'src/events/entities/event.entity';

@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  icon: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text', nullable: true })
  condition?: string | null; // Ex: "evento.checkin.10"

  // Se a raridade for deletada, o campo fica nulo em vez de quebrar
  @ManyToOne(() => Rarity, (rarity) => rarity.achievements, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  rarity?: Rarity | null;

  // Se o evento for deletado, a conquista continua existindo
  @OneToOne(() => Event, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  linkedEvent?: Event | null;

  @CreateDateColumn()
  createdAt: Date;

  obtainedPercentage?: number;
  isObtained?: boolean;
  isHighlighted?: boolean;
  acquiredAt?: Date | null;
}
