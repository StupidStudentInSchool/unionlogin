import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, boolean, integer, jsonb, index, text } from "drizzle-orm/pg-core";

// 租户表
export const tenants = pgTable(
  "tenants",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    settings: jsonb("settings"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("tenants_slug_idx").on(table.slug),
    index("tenants_status_idx").on(table.status),
  ]
);

// 部门表
export const departments = pgTable(
  "departments",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: varchar("tenant_id", { length: 36 }).references(() => tenants.id),
    name: varchar("name", { length: 128 }).notNull(),
    parent_id: varchar("parent_id", { length: 36 }),
    description: text("description"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("departments_tenant_id_idx").on(table.tenant_id),
    index("departments_parent_id_idx").on(table.parent_id),
  ]
);

// 用户表
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: varchar("tenant_id", { length: 36 }).references(() => tenants.id),
    department_id: varchar("department_id", { length: 36 }).references(() => departments.id),
    username: varchar("username", { length: 64 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    password_hash: varchar("password_hash", { length: 255 }),
    nickname: varchar("nickname", { length: 128 }),
    avatar: varchar("avatar", { length: 512 }),
    phone: varchar("phone", { length: 32 }),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    last_login_at: timestamp("last_login_at", { withTimezone: true }),
    last_login_ip: varchar("last_login_ip", { length: 64 }),
    metadata: jsonb("metadata"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("users_tenant_id_idx").on(table.tenant_id),
    index("users_department_id_idx").on(table.department_id),
    index("users_email_idx").on(table.email),
    index("users_username_idx").on(table.username),
    index("users_status_idx").on(table.status),
    index("users_created_at_idx").on(table.created_at),
  ]
);

// OAuth 客户端表
export const oauth_clients = pgTable(
  "oauth_clients",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: varchar("tenant_id", { length: 36 }).references(() => tenants.id),
    name: varchar("name", { length: 128 }).notNull(),
    client_id: varchar("client_id", { length: 64 }).notNull().unique(),
    client_secret: varchar("client_secret", { length: 255 }).notNull(),
    client_secret_plain: varchar("client_secret_plain", { length: 255 }),
    redirect_uris: jsonb("redirect_uris").notNull().default(sql`'[]'`),
    grant_types: jsonb("grant_types").notNull().default(sql`'["authorization_code"]'`),
    scopes: jsonb("scopes").notNull().default(sql`'["openid", "profile", "email"]'`),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("oauth_clients_tenant_id_idx").on(table.tenant_id),
    index("oauth_clients_client_id_idx").on(table.client_id),
    index("oauth_clients_status_idx").on(table.status),
  ]
);

// 授权记录表
export const user_authorizations = pgTable(
  "user_authorizations",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
    client_id: varchar("client_id", { length: 36 }).notNull().references(() => oauth_clients.id),
    scopes: jsonb("scopes").notNull().default(sql`'[]'`),
    authorized_at: timestamp("authorized_at", { withTimezone: true }).defaultNow().notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    revoked_at: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("user_auths_user_id_idx").on(table.user_id),
    index("user_auths_client_id_idx").on(table.client_id),
    index("user_auths_authorized_at_idx").on(table.authorized_at),
  ]
);

// 用户会话表
export const user_sessions = pgTable(
  "user_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
    access_token: varchar("access_token", { length: 255 }).notNull().unique(),
    refresh_token: varchar("refresh_token", { length: 255 }).notNull().unique(),
    ip_address: varchar("ip_address", { length: 64 }),
    user_agent: text("user_agent"),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("user_sessions_user_id_idx").on(table.user_id),
    index("user_sessions_access_token_idx").on(table.access_token),
    index("user_sessions_refresh_token_idx").on(table.refresh_token),
    index("user_sessions_expires_at_idx").on(table.expires_at),
  ]
);

// 审计日志表
export const audit_logs = pgTable(
  "audit_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    tenant_id: varchar("tenant_id", { length: 36 }).references(() => tenants.id),
    user_id: varchar("user_id", { length: 36 }),
    client_id: varchar("client_id", { length: 36 }),
    event_type: varchar("event_type", { length: 64 }).notNull(),
    ip_address: varchar("ip_address", { length: 64 }),
    user_agent: text("user_agent"),
    request_params: jsonb("request_params"),
    response_status: integer("response_status"),
    error_message: text("error_message"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_tenant_id_idx").on(table.tenant_id),
    index("audit_logs_user_id_idx").on(table.user_id),
    index("audit_logs_client_id_idx").on(table.client_id),
    index("audit_logs_event_type_idx").on(table.event_type),
    index("audit_logs_created_at_idx").on(table.created_at),
  ]
);

// 第三方账户表
export const third_party_accounts = pgTable(
  "third_party_accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
    provider: varchar("provider", { length: 32 }).notNull(),
    provider_user_id: varchar("provider_user_id", { length: 255 }).notNull(),
    provider_email: varchar("provider_email", { length: 255 }),
    nickname: varchar("nickname", { length: 128 }),
    avatar: varchar("avatar", { length: 512 }),
    access_token: varchar("access_token", { length: 512 }),
    refresh_token: varchar("refresh_token", { length: 512 }),
    token_expires_at: timestamp("token_expires_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("third_party_user_id_idx").on(table.user_id),
    index("third_party_provider_idx").on(table.provider),
    index("third_party_provider_user_id_idx").on(table.provider, table.provider_user_id),
  ]
);

// 类型导出
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

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

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;
