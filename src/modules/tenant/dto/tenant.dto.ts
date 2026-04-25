import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ description: '租户名称' })
  @IsNotEmpty({ message: '租户名称不能为空' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '租户 slug（唯一标识，用于URL）' })
  @IsNotEmpty({ message: '租户 slug 不能为空' })
  @IsString()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({ description: '租户描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: '最大用户数', default: 100 })
  @IsOptional()
  maxUsers?: number;

  @ApiPropertyOptional({ description: '最大应用数', default: 10 })
  @IsOptional()
  maxApps?: number;

  @ApiPropertyOptional({ description: '允许的第三方登录', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedThirdParty?: string[];
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ description: '租户名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '租户描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: '最大用户数' })
  @IsOptional()
  maxUsers?: number;

  @ApiPropertyOptional({ description: '最大应用数' })
  @IsOptional()
  maxApps?: number;

  @ApiPropertyOptional({ description: '允许的第三方登录', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedThirdParty?: string[];

  @ApiPropertyOptional({ description: '租户状态', enum: [1, 0] })
  @IsOptional()
  status?: number;
}

export class TenantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  logoUrl?: string;

  @ApiProperty({ enum: [1, 0] })
  status: number;

  @ApiProperty()
  maxUsers: number;

  @ApiProperty()
  maxApps: number;

  @ApiPropertyOptional({ type: [String] })
  allowedThirdParty?: string[];

  @ApiProperty()
  createdAt: Date;
}
