import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Tenant, TenantStatus } from '../../database/entities/tenant.entity';
import {
  CreateTenantDto,
  UpdateTenantDto,
  TenantResponseDto,
} from './dto/tenant.dto';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async create(dto: CreateTenantDto): Promise<TenantResponseDto> {
    // 检查 slug 是否已存在
    const existing = await this.tenantRepository.findOne({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException('租户 slug 已存在');
    }

    const tenant = this.tenantRepository.create({
      id: uuidv4(),
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      logoUrl: dto.logoUrl,
      maxUsers: dto.maxUsers || 100,
      maxApps: dto.maxApps || 10,
      allowedThirdParty: dto.allowedThirdParty || [
        'github',
        'google',
        'wechat',
      ],
    });

    await this.tenantRepository.save(tenant);
    return this.toTenantResponse(tenant);
  }

  async findAll(): Promise<TenantResponseDto[]> {
    const tenants = await this.tenantRepository.find({
      order: { createdAt: 'DESC' },
    });
    return tenants.map((t) => this.toTenantResponse(t));
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto): Promise<TenantResponseDto> {
    const tenant = await this.findById(id);

    if (dto.name) tenant.name = dto.name;
    if (dto.description !== undefined) tenant.description = dto.description;
    if (dto.logoUrl !== undefined) tenant.logoUrl = dto.logoUrl;
    if (dto.maxUsers !== undefined) tenant.maxUsers = dto.maxUsers;
    if (dto.maxApps !== undefined) tenant.maxApps = dto.maxApps;
    if (dto.allowedThirdParty !== undefined)
      tenant.allowedThirdParty = dto.allowedThirdParty;
    if (dto.status !== undefined) tenant.status = dto.status;

    await this.tenantRepository.save(tenant);
    return this.toTenantResponse(tenant);
  }

  async delete(id: string): Promise<void> {
    const tenant = await this.findById(id);
    await this.tenantRepository.remove(tenant);
  }

  async isThirdPartyAllowed(
    tenantId: string,
    provider: string,
  ): Promise<boolean> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    if (!tenant) {
      return true; // 默认允许
    }
    if (!tenant.allowedThirdParty || tenant.allowedThirdParty.length === 0) {
      return true;
    }
    return tenant.allowedThirdParty.includes(provider);
  }

  private toTenantResponse(tenant: Tenant): TenantResponseDto {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
      logoUrl: tenant.logoUrl,
      status: tenant.status,
      maxUsers: tenant.maxUsers,
      maxApps: tenant.maxApps,
      allowedThirdParty: tenant.allowedThirdParty,
      createdAt: tenant.createdAt,
    };
  }
}
