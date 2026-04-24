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

export enum ClientStatus {
  ACTIVE = 1,
  DISABLED = 0,
}

@Entity('oauth_clients')
@Index(['clientId'])
export class OAuthClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', length: 64, unique: true })
  clientId: string;

  @Column({ name: 'client_secret', length: 255 })
  clientSecret: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'redirect_uris', type: 'json' })
  redirectUris: string[];

  @Column({ name: 'allowed_scopes', type: 'json', default: ['openid', 'profile', 'email'] })
  allowedScopes: string[];

  @Column({ name: 'logo_url', length: 500, nullable: true })
  logoUrl: string;

  @Column({ type: 'tinyint', default: ClientStatus.ACTIVE })
  status: ClientStatus;

  @Column({ name: 'tenant_id', type: 'char', length: 36, nullable: true })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => UserAuthorization, (auth) => auth.client)
  authorizations: UserAuthorization[];
}
