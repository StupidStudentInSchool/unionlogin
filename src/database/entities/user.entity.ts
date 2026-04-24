import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { UserAuthorization } from './user-authorization.entity';
import { UserSession } from './user-session.entity';

export enum UserStatus {
  ACTIVE = 1,
  DISABLED = 0,
}

@Entity('users')
@Index(['email'])
@Index(['phone'])
@Index(['status'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  username: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 20, nullable: true, unique: true })
  phone: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ length: 100, nullable: true })
  nickname: string;

  @Column({ name: 'avatar_url', length: 500, nullable: true })
  avatarUrl: string;

  @Column({ type: 'tinyint', default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ name: 'email_verified', type: 'tinyint', width: 1, default: 0 })
  emailVerified: boolean;

  @Column({ name: 'phone_verified', type: 'tinyint', width: 1, default: 0 })
  phoneVerified: boolean;

  @Column({ name: 'tenant_id', type: 'char', length: 36, nullable: true })
  tenantId: string;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date;

  @Column({ name: 'login_fail_count', type: 'int', default: 0 })
  loginFailCount: number;

  @Column({ name: 'locked_until', type: 'datetime', nullable: true })
  lockedUntil: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => UserAuthorization, (auth) => auth.user)
  authorizations: UserAuthorization[];

  @OneToMany(() => UserSession, (session) => session.user)
  sessions: UserSession[];
}
