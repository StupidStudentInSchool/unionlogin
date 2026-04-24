import { Controller, Get, Res, Redirect, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';

@ApiTags('系统')
@Controller()
export class RootController {
  @Get()
  @ApiOperation({ summary: '重定向到 API 文档' })
  @Redirect('/api/docs', 302)
  root() {
    return;
  }
}

@ApiTags('系统')
@Controller('api')
export class ApiController {
  @Get()
  @ApiOperation({ summary: 'API 欢迎页' })
  root(@Res() res: Response) {
    return res.status(HttpStatus.OK).json({
      name: 'Identity Center API',
      version: '1.0.0',
      description: '统一身份认证中心',
      docs: '/api/docs',
      health: '/api/health',
    });
  }

  @Get('health')
  @ApiOperation({ summary: '健康检查' })
  health() {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
