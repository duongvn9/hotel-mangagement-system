import 'reflect-metadata';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import mongoose from 'mongoose';
import { backfillAssets } from './database/backfill-assets.js';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true })] })
class BackfillModule {}

const app = await NestFactory.createApplicationContext(BackfillModule);
try {
  const config = app.get(ConfigService);
  const uri = config.getOrThrow<string>('MONGODB_URI');
  const connection = await mongoose.createConnection(uri).asPromise();
  try {
    await backfillAssets(connection);
  } finally {
    await connection.close();
  }
} finally {
  await app.close();
}
