import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('uploads')
export class Upload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  hash: string;

  @Column()
  url: string;

  @CreateDateColumn()
  createdAt: Date;
}
