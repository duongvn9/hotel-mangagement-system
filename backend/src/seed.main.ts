import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { runSeeds } from './database/seed.js';

// Chạy: npm run seed (hoặc docker compose exec backend npm run seed)
const app = await NestFactory.createApplicationContext(AppModule);
try {
  await runSeeds(app);
} finally {
  await app.close();
}
