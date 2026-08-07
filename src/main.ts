/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser'; // Fixed import
import * as express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { SeedService } from './common/seed/seedService';

import { RedisIoAdapter } from './common/redis/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const seedService = app.get(SeedService);

  try {
    console.log('Starting data seeding processing...');
    await seedService.seedSuperAdmin();
    console.log('Seeding execution process finished.');
  } catch (error) {
    console.error('Seeding process failed with exception error:', error);
  }

  app.useStaticAssets(join(process.cwd(), 'public'));

  app.use(
    express.json({
      limit: '50mb',
      verify: (req: any, res, buf) => {
        if (req.originalUrl === '/webhooks/stripe') {
          req.rawBody = buf;
        }
      },
    }),
  );

  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      stopAtFirstError: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization',
  });

  // ৪. Swagger
  const config = new DocumentBuilder()
    .setTitle('Rhyisa project API docs!')
    .setDescription('The ByBench API description')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('accessToken')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3333;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server is running on: http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  console.error('💥 Error during bootstrap:', err);
});
