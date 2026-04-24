import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, ArrayMinSize } from 'class-validator';

export class CreateAppDto {
  @ApiProperty({ description: '应用名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '回调地址列表', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  redirectUris: string[];

  @ApiPropertyOptional({ description: '授权范围', type: [String] })
  @IsOptional()
  @IsArray()
  scopes?: string[];
}

export class UpdateAppDto {
  @ApiPropertyOptional({ description: '应用名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '回调地址列表', type: [String] })
  @IsOptional()
  @IsArray()
  redirectUris?: string[];

  @ApiPropertyOptional({ description: '授权范围', type: [String] })
  @IsOptional()
  @IsArray()
  scopes?: string[];
}
