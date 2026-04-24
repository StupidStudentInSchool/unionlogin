import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum AuditEventTypeEnum {
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  TOKEN_REFRESH = 'token_refresh',
  PASSWORD_CHANGE = 'password_change',
  PROFILE_UPDATE = 'profile_update',
  OAUTH_AUTHORIZE = 'oauth_authorize',
  OAUTH_TOKEN = 'oauth_token',
  THIRD_PARTY_LOGIN = 'third_party_login',
  SESSION_REVOKE = 'session_revoke',
}

export class QueryAuditLogDto {
  @ApiPropertyOptional({ description: '事件类型' })
  @IsOptional()
  @IsEnum(AuditEventTypeEnum)
  eventType?: AuditEventTypeEnum;

  @ApiPropertyOptional({ description: '用户ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: '客户端ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: '起始时间' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  pageSize?: number = 20;
}

export class AuditLogResponseDto {
  id: string;
  eventType: string;
  userId?: string;
  clientId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestParams?: Record<string, any>;
  responseStatus?: number;
  errorMessage?: string;
  createdAt: Date;
}
