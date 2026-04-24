import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThirdPartyController } from './third-party.controller';
import { ThirdPartyService } from './third-party.service';
import { ThirdPartyAccount } from '../../database/entities/third-party-account.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ThirdPartyAccount]),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AuditModule),
  ],
  controllers: [ThirdPartyController],
  providers: [ThirdPartyService],
  exports: [ThirdPartyService],
})
export class ThirdPartyModule {}
