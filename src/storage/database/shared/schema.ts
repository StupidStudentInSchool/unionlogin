import {
  pgTable,
  varchar,
  timestamp,
  jsonb,
  text,
  uuid,
  integer,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 租户表
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 128 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    plan: varchar('plan', { length: 64 }),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('tenants_slug_key').on(table.slug)],
);

// 部门表
export const departments = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').references(() => tenants.id),
    name: varchar('name', { length: 128 }).notNull(),
    code: varchar('code', { length: 64 }),
    parent_id: uuid('parent_id'),
    level: integer('level'),
    sort_order: integer('sort_order'),
    description: text('description'),
    status: varchar('status', { length: 20 }),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('departments_tenant_id_code_key').on(
      table.tenant_id,
      table.code,
    ),
  ],
);

// 角色表
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').references(() => tenants.id),
    name: varchar('name', { length: 128 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    level: integer('level').default(0),
    description: text('description'),
    is_system: boolean('is_system').default(false),
    status: varchar('status', { length: 20 }).default('active'),
    permissions: text('permissions').array(),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('roles_tenant_id_code_key').on(table.tenant_id, table.code),
  ],
);

// 用户表
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    username: varchar('username', { length: 64 }).notNull(),
    email: varchar('email', { length: 255 }),
    password_hash: varchar('password_hash', { length: 255 }),
    nickname: varchar('nickname', { length: 128 }),
    avatar: text('avatar'),
    phone: varchar('phone', { length: 32 }),
    status: varchar('status', { length: 20 }).default('active'),
    last_login_at: timestamp('last_login_at', { withTimezone: true }),
    last_login_ip: varchar('last_login_ip', { length: 64 }),
    metadata: jsonb('metadata'),
    department_id: uuid('department_id'),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_tenant_id_username_key').on(
      table.tenant_id,
      table.username,
    ),
  ],
);

// 用户角色关联表
export const user_roles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role_id: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    granted_by: uuid('granted_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('user_roles_user_id_role_id_key').on(
      table.user_id,
      table.role_id,
    ),
  ],
);

// 用户部门关联表
export const user_departments = pgTable(
  'user_departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    department_id: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('user_departments_user_id_department_id_key').on(
      table.user_id,
      table.department_id,
    ),
  ],
);

// 用户应用授权表 - 控制用户可以访问哪些应用
export const user_app_permissions = pgTable(
  'user_app_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    app_id: uuid('app_id')
      .notNull()
      .references(() => oauth_clients.id),
    granted_by: uuid('granted_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('user_app_permissions_user_id_app_id_key').on(
      table.user_id,
      table.app_id,
    ),
  ],
);

// OAuth 客户端表
export const oauth_clients = pgTable(
  'oauth_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .references(() => tenants.id)
      .notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    client_id: varchar('client_id', { length: 64 }).notNull(),
    client_secret: varchar('client_secret', { length: 255 }),
    redirect_uris: text('redirect_uris').array(),
    grant_types: text('grant_types').array(),
    scopes: text('scopes').array(),
    status: varchar('status', { length: 20 }).default('active'),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }),
    client_secret_plain: varchar('client_secret_plain', { length: 255 }),
  },
  (table) => [uniqueIndex('oauth_clients_client_id_key').on(table.client_id)],
);

// 授权记录表
export const user_authorizations = pgTable('user_authorizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id),
  client_id: uuid('client_id')
    .notNull()
    .references(() => oauth_clients.id),
  scope: text('scope'),
  code_challenge: varchar('code_challenge', { length: 128 }),
  code_challenge_method: varchar('code_challenge_method', { length: 16 }),
  nonce: varchar('nonce', { length: 128 }),
  state: text('state'),
  redirect_uri: text('redirect_uri'),
  created_at: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }),
});

// 用户会话表
export const user_sessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    token_hash: varchar('token_hash', { length: 255 }).notNull(),
    refresh_token_hash: varchar('refresh_token_hash', {
      length: 255,
    }).notNull(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    ip_address: varchar('ip_address', { length: 64 }),
    user_agent: text('user_agent'),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex('user_sessions_token_hash_key').on(table.token_hash)],
);

// 审计日志表
export const audit_logs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').references(() => tenants.id),
  user_id: uuid('user_id').references(() => users.id),
  event_type: varchar('event_type', { length: 64 }).notNull(),
  ip_address: varchar('ip_address', { length: 64 }),
  user_agent: text('user_agent'),
  details: jsonb('details'),
  created_at: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 第三方账户表
export const third_party_accounts = pgTable(
  'third_party_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    provider: varchar('provider', { length: 32 }).notNull(),
    provider_user_id: varchar('provider_user_id', { length: 255 }).notNull(),
    access_token: text('access_token'),
    refresh_token: text('refresh_token'),
    metadata: jsonb('metadata'),
    created_at: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('third_party_accounts_provider_provider_user_id_key').on(
      table.provider,
      table.provider_user_id,
    ),
  ],
);

// 健康检查表
export const health_check = pgTable('health_check', {
  id: integer('id').primaryKey(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 类型导出
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type UserRole = typeof user_roles.$inferSelect;
export type InsertUserRole = typeof user_roles.$inferInsert;

export type UserDepartment = typeof user_departments.$inferSelect;
export type InsertUserDepartment = typeof user_departments.$inferInsert;

export type UserAppPermission = typeof user_app_permissions.$inferSelect;
export type InsertUserAppPermission = typeof user_app_permissions.$inferInsert;

export type OAuthClient = typeof oauth_clients.$inferSelect;
export type InsertOAuthClient = typeof oauth_clients.$inferInsert;

export type UserAuthorization = typeof user_authorizations.$inferSelect;
export type InsertUserAuthorization = typeof user_authorizations.$inferInsert;

export type UserSession = typeof user_sessions.$inferSelect;
export type InsertUserSession = typeof user_sessions.$inferInsert;

export type AuditLog = typeof audit_logs.$inferSelect;
export type InsertAuditLog = typeof audit_logs.$inferInsert;

export type ThirdPartyAccount = typeof third_party_accounts.$inferSelect;
export type InsertThirdPartyAccount = typeof third_party_accounts.$inferInsert;
