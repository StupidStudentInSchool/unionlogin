import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 启用 cookie 解析
  // 使用 require 方式引入 cookie-parser
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use(require('cookie-parser')());

  // 启用静态文件服务
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
  });

  // 不使用全局前缀，每个控制器手动添加 /api 前缀

  // 在所有其他中间件之后添加租户中间件
  app.use((req: any, res: any, next: any) => {
    console.log(
      '[Tenant Middleware] URL:',
      req.url,
      'Tenant:',
      req.headers['x-tenant-id'] || 'default',
    );
    req.tenantId = req.headers['x-tenant-id'] || 'default';
    next();
  });

  // 全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger 文档
  const config = new DocumentBuilder()
    .setTitle('Identity Center API')
    .setDescription('统一身份认证中心 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.APP_PORT || 5000;
  await app.listen(port);
  console.log(`Identity Center is running on http://0.0.0.0:${port}`);
  console.log(`Swagger UI: http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
