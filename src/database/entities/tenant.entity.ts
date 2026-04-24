import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TenantStatus {
  ACTIVE = 1,
  DISABLED = 0,
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({ length: 255, nullable: true })
  description: string;

  @Column({ name: 'logo_url', length: 500, nullable: true })
  logoUrl: string;

  @Column({ type: 'tinyint', default: TenantStatus.ACTIVE })
  status: TenantStatus;

  @Column({ name: 'max_users', type: 'int', default: 100 })
  maxUsers: number;

  @Column({ name: 'max_apps', type: 'int', default: 10 })
  maxApps: number;

  @Column({ name: 'allowed_third_party', type: 'json', nullable: true })
  allowedThirdParty: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
