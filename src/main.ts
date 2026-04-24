import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  
  // 全局前缀
  app.setGlobalPrefix('api');
  
  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  
  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());
  
  // 全局响应拦截器
  app.useGlobalInterceptors(new TransformInterceptor());
  
  // CORS 配置
  app.enableCors({
    origin: configService.get<string>('app.frontendUrl', 'http://localhost:3000'),
    credentials: true,
  });
  
  // 租户中间件
  app.use(new TenantMiddleware(configService).use.bind(TenantMiddleware));
  
  // Swagger 文档
  const config = new DocumentBuilder()
    .setTitle('Identity Center API')
    .setDescription('统一身份认证中心 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  
  const port = configService.get<number>('app.port') || 5000;
  const host = configService.get<string>('app.host') || '0.0.0.0';
  
  await app.listen(port, host);
  console.log(`Identity Center is running on: http://${host}:${port}`);
  console.log(`Swagger docs: http://${host}:${port}/api/docs`);
}

bootstrap();
