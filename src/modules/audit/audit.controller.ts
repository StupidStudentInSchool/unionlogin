import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { QueryAuditLogDto, AuditLogResponseDto } from './dto/audit.dto';

@ApiTags('审计日志')
@Controller('audit')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: '查询审计日志' })
  @ApiResponse({ status: 200, description: '日志列表' })
  async queryLogs(@Query() query: QueryAuditLogDto) {
    const result = await this.auditService.queryLogs(query);
    return {
      list: result.list,
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
