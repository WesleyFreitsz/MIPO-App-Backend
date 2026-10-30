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
  MODERATOR = 'MODERATOR',
  WAITER = 'WAITER',
  ADMIN = 'ADMIN',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Legado: substituído por birthDate.
  @Column({ type: 'int', nullable: true })
  age: number | null;

  @Column({ type: 'date', nullable: true, select: false })
  birthDate: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true, select: false })
  ageVerificationMethod: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  termsVersion: string | null;

  @Column({ type: 'timestamp', nullable: true })
  termsAcceptedAt: Date | null;

  @OneToMany(() => UserAchievement, (userAchievement) => userAchievement.user)
  achievements: UserAchievement[];

  @Column({ type: 'varchar', unique: true, nullable: true, select: false })
  email: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true, select: false })
  phoneNumber: string | null;

  @Column({ select: false })
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

  @Column({ default: true })
  showInStorePresence: boolean;

  @Column({ default: true })
  showLastSeen: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true, select: false })
  notificationToken: string | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  recoveryCode: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  recoveryCodeExpires: Date | null;

  @Column({ type: 'int', default: 0, select: false })
  recoveryAttempts: number;
}
