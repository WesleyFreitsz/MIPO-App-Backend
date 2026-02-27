import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import { UserAchievement } from './user-achievement.entity';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  age: number;

  @OneToMany(() => UserAchievement, (userAchievement) => userAchievement.user)
  achievements: UserAchievement[];

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  phoneNumber: string | null;

  @Column()
  password: string;

  // Perfil
  @Column({ type: 'varchar', unique: true, nullable: true })
  nickname: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ default: false })
  isProfileComplete: boolean;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ default: 0 })
  participation: number;

  @Column({ default: 0 })
  coins: number;

  @Column({ default: false })
  banned: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  notificationToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  recoveryCode: string | null;

  @Column({ type: 'timestamp', nullable: true })
  recoveryCodeExpires: Date | null;
}
