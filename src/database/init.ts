/**
 * 数据库初始化脚本
 * 运行: pnpm ts-node src/database/init.ts
 */

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserStatus } from './entities/user.entity';
import { OAuthClient, ClientStatus } from './entities/oauth-client.entity';
import { Tenant, TenantStatus } from './entities/tenant.entity';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root123',
  database: process.env.DB_NAME || 'identity_center',
  entities: [__dirname + '/entities/*.entity.ts'],
  synchronize: true,
  logging: true,
});

async function init() {
  try {
    await dataSource.initialize();
    console.log('Database connected');

    // 创建默认租户
    const tenantRepo = dataSource.getRepository(Tenant);
    let defaultTenant = await tenantRepo.findOne({
      where: { slug: 'default' },
    });

    if (!defaultTenant) {
      defaultTenant = tenantRepo.create({
        name: 'Default Tenant',
        slug: 'default',
        description: 'Default tenant for all users',
        status: TenantStatus.ACTIVE,
        maxUsers: 1000,
        maxApps: 100,
        allowedThirdParty: ['github', 'google', 'wechat'],
      });
      await tenantRepo.save(defaultTenant);
      console.log('Default tenant created');
    }

    // 创建管理员用户
    const userRepo = dataSource.getRepository(User);
    let adminUser = await userRepo.findOne({ where: { username: 'admin' } });

    if (!adminUser) {
      const passwordHash = await bcrypt.hash('admin123', 12);
      adminUser = userRepo.create({
        username: 'admin',
        email: 'admin@example.com',
        passwordHash,
        nickname: 'Administrator',
        status: UserStatus.ACTIVE,
        emailVerified: true,
        tenantId: defaultTenant.id,
      });
      await userRepo.save(adminUser);
      console.log('Admin user created (username: admin, password: admin123)');
    }

    // 创建示例应用
    const clientRepo = dataSource.getRepository(OAuthClient);
    let exampleApp = await clientRepo.findOne({
      where: { name: 'Example App' },
    });

    if (!exampleApp) {
      const clientId = 'example_app';
      const clientSecret = await bcrypt.hash('example_secret', 12);

      exampleApp = clientRepo.create({
        clientId,
        clientSecret,
        name: 'Example App',
        description: 'Example application for testing',
        redirectUris: [
          'http://localhost:3000/callback',
          'http://localhost:8080/callback',
        ],
        allowedScopes: ['openid', 'profile', 'email'],
        status: ClientStatus.ACTIVE,
        tenantId: defaultTenant.id,
      });
      await clientRepo.save(exampleApp);
      console.log(
        'Example app created (client_id: example_app, client_secret: example_secret)',
      );
    }

    console.log('\nInitialization completed!');
    console.log('\nYou can login with:');
    console.log('  Username: admin');
    console.log('  Password: admin123');

    await dataSource.destroy();
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
  }
}

init();
