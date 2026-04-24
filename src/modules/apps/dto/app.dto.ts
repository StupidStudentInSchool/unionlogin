import { IsNotEmpty, IsString, IsArray, IsUrl, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppDto {
  @ApiProperty({ description: '应用名称' })
  @IsNotEmpty({ message: '应用名称不能为空' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: '应用描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '允许的重定向URI列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  redirectUris: string[];

  @ApiPropertyOptional({ description: '允许的授权范围', type: [String], default: ['openid', 'profile', 'email'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedScopes?: string[];

  @ApiPropertyOptional({ description: '应用Logo URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  logoUrl?: string;
}

export class UpdateAppDto {
  @ApiPropertyOptional({ description: '应用名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '应用描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '允许的重定向URI列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  redirectUris?: string[];

  @ApiPropertyOptional({ description: '允许的授权范围', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedScopes?: string[];

  @ApiPropertyOptional({ description: '应用Logo URL' })
  @IsOptional()
  @IsString()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: '应用状态', enum: [1, 0] })
  @IsOptional()
  status?: number;
}

export class AppResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  clientId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ type: [String] })
  redirectUris: string[];

  @ApiProperty({ type: [String] })
  allowedScopes: string[];

  @ApiPropertyOptional()
  logoUrl?: string;

  @ApiProperty({ enum: [1, 0] })
  status: number;

  @ApiProperty()
  createdAt: Date;
}

export class AppWithSecretDto extends AppResponseDto {
  @ApiProperty({ description: '应用密钥（仅创建时返回）' })
  clientSecret: string;
}
