import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { auditService } from '../../storage/database/services';
import { Public } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('审计日志')
@Controller('api/audit')
export class AuditController {
  @UseGuards(AuthGuard)
  @Get('logs')
  @ApiOperation({ summary: '查询审计日志' })
  async queryLogs(
    @Query('eventType') eventType: string,
    @Query('userId') userId: string,
    @Query('clientId') clientId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Req() req: Request,
  ) {
    const tenantId = (req.headers['x-tenant-id'] as string) || undefined;
    return auditService.query({
      eventType,
      userId,
      clientId,
      startTime,
      endTime,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      tenantId,
    });
  }
}
