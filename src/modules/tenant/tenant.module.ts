import { Module } from '@nestjs/common';
import { tenantService } from '../../storage/database/services';

@Module({})
export class TenantModule {}

export { tenantService };
