import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChatMember } from './chat-member.entity';
import { ChatMessage } from './chat-message.entity';

export enum ChatType {
  PRIVATE = 'PRIVATE',
  GROUP = 'GROUP',
  EVENT = 'EVENT',
}

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ChatType, default: ChatType.PRIVATE })
  type: ChatType;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column('uuid')
  createdByUserId: string;

  // 🚀 NOVO: Armazena o ID da última mensagem para evitar subqueries pesadas
  @Column({ nullable: true })
  lastMessageId: string;

  @ManyToOne(() => ChatMessage, { nullable: true })
  @JoinColumn({ name: 'lastMessageId' })
  lastMessage: ChatMessage;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ChatMember, (member) => member.chat)
  members: ChatMember[];

  @OneToMany(() => ChatMessage, (message) => message.chat)
  messages: ChatMessage[];
}
