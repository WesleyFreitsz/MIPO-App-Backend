import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

@Entity()
export class Notifications {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ type: 'json', nullable: true })
  data: any; // Guardará o ID do post, evento ou usuário

  @Column({ nullable: true })
  icon: string; // Ex: 'dice', 'info', 'alert'

  @Column({ default: false })
  isRead: boolean;

  // Se null, é uma notificação global para todos
  @ManyToOne(() => User, { nullable: true })
  user: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
