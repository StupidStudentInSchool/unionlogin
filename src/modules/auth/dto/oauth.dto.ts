import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';

export class AuthorizeDto {
  @ApiProperty({ description: '客户端ID' })
  @IsString()
  clientId: string;

  @ApiProperty({ description: '回调地址' })
  @IsString()
  redirectUri: string;

  @ApiProperty({ description: '响应类型', default: 'code' })
  @IsString()
  responseType: string = 'code';

  @ApiPropertyOptional({ description: '授权范围', type: [String] })
  @IsOptional()
  @IsArray()
  scope?: string[];

  @ApiPropertyOptional({ description: '状态参数' })
  @IsOptional()
  @IsString()
  state?: string;
}

export class TokenRequestDto {
  @ApiProperty({ description: '授权类型' })
  @IsString()
  grantType: string;

  @ApiPropertyOptional({ description: '客户端ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: '客户端密钥' })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiPropertyOptional({ description: '授权码' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: '回调地址' })
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @ApiPropertyOptional({ description: '刷新令牌' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export class UserInfoResponseDto {
  id: string;
  username: string;
  email: string;
  nickname?: string;
  avatar?: string;
}

export class IntrospectRequestDto {
  @ApiProperty({ description: 'Token' })
  @IsString()
  token: string;
}

export class IntrospectResponseDto {
  active: boolean;
  sub?: string;
  exp?: number;
}

export class RevokeRequestDto {
  @ApiProperty({ description: 'Token' })
  @IsString()
  token: string;
}
