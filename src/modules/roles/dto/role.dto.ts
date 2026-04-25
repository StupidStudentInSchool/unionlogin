import { IsString, IsOptional, IsInt, Min, IsArray } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  level?: number;
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  level?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

export class AssignRolesDto {
  @IsString()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}
