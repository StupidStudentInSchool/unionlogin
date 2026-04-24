import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { OAuthClient, ClientStatus } from '../../database/entities/oauth-client.entity';
import { CreateAppDto, UpdateAppDto, AppResponseDto, AppWithSecretDto } from './dto/app.dto';

@Injectable()
export class AppsService {
  constructor(
    @InjectRepository(OAuthClient)
    private clientRepository: Repository<OAuthClient>,
  ) {}

  async create(dto: CreateAppDto, tenantId?: string): Promise<AppWithSecretDto> {
    // 生成 Client ID 和 Secret
    const clientId = `app_${crypto.randomBytes(16).toString('hex')}`;
    const clientSecret = crypto.randomBytes(32).toString('base64url');
    const hashedSecret = await bcrypt.hash(clientSecret, 12);

    const client = this.clientRepository.create({
      id: uuidv4(),
      clientId,
      clientSecret: hashedSecret,
      name: dto.name,
      description: dto.description,
      redirectUris: dto.redirectUris,
      allowedScopes: dto.allowedScopes || ['openid', 'profile', 'email'],
      logoUrl: dto.logoUrl,
      tenantId,
    });

    await this.clientRepository.save(client);

    return {
      id: client.id,
      clientId: client.clientId,
      clientSecret, // 仅创建时返回
      name: client.name,
      description: client.description,
      redirectUris: client.redirectUris,
      allowedScopes: client.allowedScopes,
      logoUrl: client.logoUrl,
      status: client.status,
      createdAt: client.createdAt,
    };
  }

  async findAll(tenantId?: string): Promise<AppResponseDto[]> {
    const where = tenantId ? { tenantId } : {};
    const clients = await this.clientRepository.find({ where });
    return clients.map((c) => this.toAppResponse(c));
  }

  async findById(id: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('应用不存在');
    }
    return client;
  }

  async findByClientId(clientId: string): Promise<OAuthClient> {
    const client = await this.clientRepository.findOne({ where: { clientId } });
    if (!client) {
      throw new NotFoundException('应用不存在');
    }
    return client;
  }

  async update(id: string, dto: UpdateAppDto): Promise<AppResponseDto> {
    const client = await this.findById(id);

    if (dto.name) client.name = dto.name;
    if (dto.description !== undefined) client.description = dto.description;
    if (dto.redirectUris) client.redirectUris = dto.redirectUris;
    if (dto.allowedScopes) client.allowedScopes = dto.allowedScopes;
    if (dto.logoUrl !== undefined) client.logoUrl = dto.logoUrl;
    if (dto.status !== undefined) client.status = dto.status;

    await this.clientRepository.save(client);
    return this.toAppResponse(client);
  }

  async delete(id: string): Promise<void> {
    const client = await this.findById(id);
    await this.clientRepository.remove(client);
  }

  async validateClient(clientId: string, clientSecret?: string): Promise<OAuthClient> {
    const client = await this.findByClientId(clientId);

    if (client.status !== ClientStatus.ACTIVE) {
      throw new BadRequestException('应用已被禁用');
    }

    if (clientSecret) {
      const isValid = await bcrypt.compare(clientSecret, client.clientSecret);
      if (!isValid) {
        throw new BadRequestException('应用密钥不正确');
      }
    }

    return client;
  }

  async validateRedirectUri(clientId: string, redirectUri: string): Promise<boolean> {
    const client = await this.findByClientId(clientId);
    return client.redirectUris.includes(redirectUri);
  }

  async validateScopes(clientId: string, requestedScopes: string[]): Promise<string[]> {
    const client = await this.findByClientId(clientId);
    const allowed = client.allowedScopes || [];
    
    // 如果没有请求特定范围，返回所有允许的范围
    if (!requestedScopes || requestedScopes.length === 0) {
      return allowed;
    }

    // 过滤只返回允许的范围
    return requestedScopes.filter((scope) => allowed.includes(scope));
  }

  private toAppResponse(client: OAuthClient): AppResponseDto {
    return {
      id: client.id,
      clientId: client.clientId,
      name: client.name,
      description: client.description,
      redirectUris: client.redirectUris,
      allowedScopes: client.allowedScopes,
      logoUrl: client.logoUrl,
      status: client.status,
      createdAt: client.createdAt,
    };
  }
}
