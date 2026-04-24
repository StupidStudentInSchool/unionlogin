import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';
import { OAuthClient } from '../../database/entities/oauth-client.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OAuthClient])],
  controllers: [AppsController],
  providers: [AppsService],
  exports: [AppsService],
})
export class AppsModule {}
