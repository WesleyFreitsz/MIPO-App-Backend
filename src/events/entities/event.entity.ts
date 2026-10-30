import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

export enum EventSpace {
  EXTERNO = 'EXTERNO',
  SALAO = 'SALAO',
  // shortcut: mantido só para eventos antigos; a Salinha foi removida do app.
  SALINHA = 'SALINHA',
  PERSONALIZADO = 'PERSONALIZADO',
}

export enum EventStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REPROVED = 'REPROVED',
  CONCLUDED = 'CONCLUDED',
}

@Entity()
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ type: 'enum', enum: EventSpace })
  space: EventSpace;

  @Column({ type: 'varchar', nullable: true })
  customLocation: string | null;

  @Column({ type: 'varchar', nullable: true })
  bannerUrl: string | null;

  @Column('timestamp')
  dateTime: Date;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.PENDING })
  status: EventStatus;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason: string | null;

  // 👇 NOVA COLUNA ADICIONADA AQUI PARA SALVAR O CHAT 👇
  @Column({ type: 'varchar', nullable: true })
  chatId: string | null;

  @ManyToOne(() => User)
  creator: User;

  @ManyToMany(() => User)
  @JoinTable()
  participants: User[];

  @Column({ type: 'simple-array', nullable: true })
  checkedInUserIds: string[];

  @Column({ type: 'timestamp', nullable: true })
  reminder24hSentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  reminder1hSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
