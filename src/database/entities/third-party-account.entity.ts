import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('third_party_accounts')
@Index(['provider', 'providerId'], { unique: true })
@Index(['userId'])
export class ThirdPartyAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ length: 50 })
  provider: string; // 'github', 'google', 'wechat'

  @Column({ name: 'provider_id', length: 255 })
  providerId: string;

  @Column({ name: 'provider_email', length: 255, nullable: true })
  providerEmail: string;

  @Column({ name: 'provider_nickname', length: 100, nullable: true })
  providerNickname: string;

  @Column({ name: 'provider_avatar', length: 500, nullable: true })
  providerAvatar: string;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken: string;

  @Column({ name: 'token_expires_at', type: 'datetime', nullable: true })
  tokenExpiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
