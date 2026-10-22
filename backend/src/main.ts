import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import type { AppConfig } from './config/configuration.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<AppConfig, true>);
  const prefix = config.get('apiPrefix', { infer: true });

  app.use(helmet());
  app.enableCors({
    origin: config.get('corsOrigins', { infer: true }),
    credentials: true,
  });
  app.setGlobalPrefix(prefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (config.get('swaggerEnabled', { infer: true })) {
    const doc = new DocumentBuilder()
      .setTitle('HMS API')
      .setDescription('Hotel Management System API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(`${prefix}/docs`, app, () =>
      SwaggerModule.createDocument(app, doc),
    );
  }

  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`API chạy tại http://localhost:${port}/${prefix}/v1`, 'Bootstrap');
}
await bootstrap();
