import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Chat } from './chat.entity';
import { ChatMessageReaction } from './chat-message-reaction.entity';

@Entity('chat_messages')
@Index(['chatId', 'createdAt'])
@Index('UQ_chat_messages_user_client', ['userId', 'clientId'], { unique: true })
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @Index()
  @Column('uuid')
  chatId: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'uuid', nullable: true })
  replyToId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  clientId: string | null;

  @ManyToOne(() => ChatMessage, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replyToId' })
  replyTo: ChatMessage | null;

  @OneToMany(() => ChatMessageReaction, (reaction) => reaction.message)
  reactions: ChatMessageReaction[];

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat: Chat;

  // 🚨 CORREÇÃO: Removido eager: true para não pesar o banco
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;
}
