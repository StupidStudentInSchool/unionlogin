import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import {
  AuditLog,
  AuditEventType,
} from '../../database/entities/audit-log.entity';
import { QueryAuditLogDto } from './dto/audit.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async createLog(params: {
    eventType: AuditEventType;
    userId?: string;
    clientId?: string;
    ipAddress?: string;
    userAgent?: string;
    requestParams?: Record<string, any>;
    responseStatus?: number;
    errorMessage?: string;
    tenantId?: string;
  }): Promise<void> {
    const log = new AuditLog();
    log.id = require('uuid').v4();
    log.eventType = params.eventType;
    log.userId = params.userId || '';
    log.clientId = params.clientId || '';
    log.ipAddress = params.ipAddress || '';
    log.userAgent = params.userAgent || '';
    log.requestParams = params.requestParams || {};
    log.responseStatus = params.responseStatus || 0;
    log.errorMessage = params.errorMessage || '';
    log.tenantId = params.tenantId || '';

    // 异步保存，不阻塞主流程
    this.auditLogRepository.save(log).catch((err) => {
      console.error('Failed to save audit log:', err);
    });
  }

  async queryLogs(
    query: QueryAuditLogDto,
  ): Promise<{ list: AuditLog[]; total: number }> {
    const {
      eventType,
      userId,
      clientId,
      startTime,
      endTime,
      page = 1,
      pageSize = 20,
    } = query;

    const where: any = {};

    if (eventType) where.eventType = eventType;
    if (userId) where.userId = userId;
    if (clientId) where.clientId = clientId;

    if (startTime && endTime) {
      where.createdAt = Between(new Date(startTime), new Date(endTime)) as any;
    }

    const [list, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { list, total };
  }
}
