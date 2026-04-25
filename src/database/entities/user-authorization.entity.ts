import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { OAuthClient } from './oauth-client.entity';

@Entity('user_authorizations')
@Index(['userId', 'clientId'], { unique: true })
@Index(['userId'])
@Index(['clientId'])
export class UserAuthorization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ name: 'client_id', type: 'char', length: 36 })
  clientId: string;

  @Column({ type: 'json' })
  scopes: string[];

  @Column({ name: 'access_token', length: 512, nullable: true })
  accessToken: string;

  @Column({ name: 'refresh_token', length: 512, nullable: true })
  refreshToken: string;

  @Column({ name: 'token_expires_at', type: 'datetime', nullable: true })
  tokenExpiresAt: Date;

  @ManyToOne(() => User, (user) => user.authorizations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => OAuthClient, (client) => client.authorizations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'client_id' })
  client: OAuthClient;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
