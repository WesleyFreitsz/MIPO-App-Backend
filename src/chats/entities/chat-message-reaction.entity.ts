import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_message_reactions')
@Unique(['messageId', 'userId', 'emoji'])
export class ChatMessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  messageId: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  emoji: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ChatMessage, (message) => message.reactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'messageId' })
  message: ChatMessage;
}
