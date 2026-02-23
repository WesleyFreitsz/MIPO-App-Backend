import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Mudou para simple-array para suportar múltiplas categorias
  @Column({ type: 'simple-array', nullable: true })
  category: string[];

  @Column({ type: 'int', default: 2 })
  minPlayers: number;

  @Column({ type: 'int', default: 4 })
  maxPlayers: number;

  @Column({ type: 'text', nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  videoUrl: string;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
