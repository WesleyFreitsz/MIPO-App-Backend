import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { ChatMessage } from '../../chats/entities/chat-message.entity';

export enum ReportType {
  POST = 'POST',
  USER = 'USER',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ReportType, default: ReportType.POST })
  type: ReportType;

  @Column({ type: 'text' })
  reason: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: false })
  dismissed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterUserId' })
  reporterUser: User;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportedUserId' })
  reportedUser: User;

  @ManyToOne(() => Post, { eager: true, onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @ManyToOne(() => ChatMessage, {
    eager: true,
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'chatMessageId' })
  chatMessage: ChatMessage | null;
}
