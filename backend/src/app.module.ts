import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { configuration, type AppConfig } from './config/configuration.js';
import { envValidationSchema } from './config/env.validation.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        uri: config.get('mongo.uri', { infer: true }),
        autoIndex: config.get('env', { infer: true }) !== 'production',
      }),
    }),
    HealthModule,
    // Module nghiệp vụ thêm vào đây, xem src/modules/README.md
  ],
})
export class AppModule {}
