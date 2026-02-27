import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Achievement } from './achievement.entity';

@Entity('achievement_rarities')
export class Rarity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: '#ffffff' })
  color: string;

  @Column({ type: 'int', default: 0 })
  orderIndex: number; // Para ordenar de mais rara para menos rara

  @OneToMany(() => Achievement, (achievement) => achievement.rarity)
  achievements: Achievement[];
}
