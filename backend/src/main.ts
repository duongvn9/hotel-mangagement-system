import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
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
  app.enableShutdownHooks();

  if (config.get('swaggerEnabled', { infer: true })) {
    const doc = new DocumentBuilder()
      .setTitle('HMS API')
      .setDescription('Hotel Management System API')
      .setVersion('1.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer');
    // Ô nhập header giả lập user cho Swagger, xem common/auth/dev-auth.middleware.ts
    if (config.get('env', { infer: true }) !== 'production') {
      doc
        .addApiKey(
          { type: 'apiKey', in: 'header', name: 'x-dev-role' },
          'x-dev-role',
        )
        .addApiKey(
          { type: 'apiKey', in: 'header', name: 'x-dev-user-id' },
          'x-dev-user-id',
        )
        .addSecurityRequirements('x-dev-role')
        .addSecurityRequirements('x-dev-user-id');
    }
    SwaggerModule.setup(`${prefix}/docs`, app, () =>
      SwaggerModule.createDocument(app, doc.build()),
    );
  }

  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`API chạy tại http://localhost:${port}/${prefix}/v1`, 'Bootstrap');
}
await bootstrap();
