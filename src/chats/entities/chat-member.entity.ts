import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Chat } from './chat.entity';

export enum ChatMemberRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

@Entity('chat_members')
@Index(['userId', 'chatId'])
@Index(['chatId'])
export class ChatMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  chatId: string;

  @Column('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: ChatMemberRole,
    default: ChatMemberRole.MEMBER,
  })
  role: ChatMemberRole;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastReadAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  customColor: string; // Cor do nome (Pública)

  @Column({ nullable: true })
  backgroundTheme: string; // <-- NOVA: Cor de fundo do chat (Pessoal)
  // Adicione esta coluna na entidade ChatMember

  @ManyToOne(() => Chat, (chat) => chat.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat: Chat;

  // Eager removido para evitar carregar dados do usuário desnecessariamente em massa
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;
}
