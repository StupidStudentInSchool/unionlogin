import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { RootController, ApiController } from './app.controller';
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
import { InitController } from './modules/init/init.controller';
import { DepartmentsController } from './modules/departments/departments.controller';
import { DepartmentsModule } from './modules/departments/departments.module';
import { RolesController } from './modules/roles/roles.controller';
import { RolesModule } from './modules/roles/roles.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    AppsModule,
    ThirdPartyModule,
    AuditModule,
    TenantModule,
    DepartmentsModule,
    RolesModule,
  ],
  controllers: [
    RootController,
    ApiController,
    AuthController,
    UsersController,
    AppsController,
    ThirdPartyController,
    AuditController,
    TenantController,
    InitController,
    DepartmentsController,
    RolesController,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
