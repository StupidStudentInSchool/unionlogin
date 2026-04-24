import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthController } from './modules/auth/auth.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersController } from './modules/users/users.controller';
import { UsersModule } from './modules/users/users.module';
import { AppsController } from './modules/apps/apps.controller';
import { AppsModule } from './modules/apps/apps.module';
import { ThirdPartyController } from './modules/third-party/third-party.controller';
import { ThirdPartyModule } from './modules/third-party/third-party.module';
import { AuditController } from './modules/audit/audit.controller';
import { AuditModule } from './modules/audit/audit.module';
import { TenantController } from './modules/tenant/tenant.controller';
import { TenantModule } from './modules/tenant/tenant.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    AppsModule,
    ThirdPartyModule,
    AuditModule,
    TenantModule,
  ],
  controllers: [
    AuthController,
    UsersController,
    AppsController,
    ThirdPartyController,
    AuditController,
    TenantController,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {
  configure(consumer: any) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
