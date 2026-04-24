import { IsNotEmpty, IsString, IsOptional, IsArray, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthorizeDto {
  @ApiProperty({ description: '应用 Client ID' })
  @IsNotEmpty({ message: 'client_id 不能为空' })
  @IsString()
  clientId: string;

  @ApiProperty({ description: '重定向URI' })
  @IsNotEmpty({ message: 'redirect_uri 不能为空' })
  @IsString()
  redirectUri: string;

  @ApiProperty({ description: 'OAuth 响应类型', default: 'code' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['code'])
  responseType: string = 'code';

  @ApiPropertyOptional({ description: '请求的权限范围', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scope?: string[];

  @ApiPropertyOptional({ description: 'CSRF 状态参数' })
  @IsOptional()
  @IsString()
  state?: string;
}

export class TokenRequestDto {
  @ApiProperty({ description: 'OAuth 授权类型', enum: ['authorization_code', 'refresh_token'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['authorization_code', 'refresh_token'])
  grantType: string;

  @ApiProperty({ description: '应用 Client ID' })
  @IsNotEmpty()
  @IsString()
  clientId: string;

  @ApiPropertyOptional({ description: '应用 Client Secret' })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiPropertyOptional({ description: '授权码（authorization_code 类型必填）' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: '重定向URI（authorization_code 类型必填）' })
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @ApiPropertyOptional({ description: 'Refresh Token（refresh_token 类型必填）' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class UserInfoResponseDto {
  @ApiProperty({ description: '用户唯一标识 (sub)' })
  sub: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiPropertyOptional()
  nickname?: string;

  @ApiPropertyOptional()
  picture?: string;

  @ApiProperty()
  updatedAt: number;
}

export class TokenResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  tokenType: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty()
  refreshToken: string;

  @ApiPropertyOptional()
  scope?: string;
}

export class IntrospectRequestDto {
  @ApiProperty({ description: '待验证的 Token' })
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class IntrospectResponseDto {
  @ApiProperty()
  active: boolean;

  @ApiPropertyOptional()
  sub?: string;

  @ApiPropertyOptional()
  clientId?: string;

  @ApiPropertyOptional()
  username?: string;

  @ApiPropertyOptional()
  scope?: string;

  @ApiPropertyOptional()
  exp?: number;

  @ApiPropertyOptional()
  iat?: number;
}

export class RevokeRequestDto {
  @ApiProperty({ description: '要撤销的 Token' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiPropertyOptional({ description: 'Token 类型提示' })
  @IsOptional()
  @IsString()
  @IsIn(['access_token', 'refresh_token'])
  tokenTypeHint?: string;
}
