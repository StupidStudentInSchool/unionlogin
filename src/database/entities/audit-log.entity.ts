import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditEventType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  TOKEN_REFRESH = 'token_refresh',
  PASSWORD_CHANGE = 'password_change',
  PROFILE_UPDATE = 'profile_update',
  OAUTH_AUTHORIZE = 'oauth_authorize',
  OAUTH_TOKEN = 'oauth_token',
  THIRD_PARTY_LOGIN = 'third_party_login',
  SESSION_REVOKE = 'session_revoke',
}

@Entity('audit_logs')
@Index(['userId'])
@Index(['eventType'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_type', length: 50 })
  eventType: AuditEventType;

  @Column({ name: 'user_id', type: 'char', length: 36, nullable: true })
  userId: string;

  @Column({ name: 'client_id', type: 'char', length: 36, nullable: true })
  clientId: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ name: 'request_params', type: 'json', nullable: true })
  requestParams: Record<string, any>;

  @Column({ name: 'response_status', type: 'tinyint', nullable: true })
  responseStatus: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'tenant_id', type: 'char', length: 36, nullable: true })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
