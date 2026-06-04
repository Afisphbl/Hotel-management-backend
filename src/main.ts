import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { startOpenTelemetry, stopOpenTelemetry } from './observability/otel';

async function bootstrap() {
  await startOpenTelemetry();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  // Use Pino for logging
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // Enable CORS for frontend requests
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        ...(process.env.CORS_ORIGINS
          ? process.env.CORS_ORIGINS.split(',')
          : []),
      ];

      // Allow any .localhost:3000 subdomain (for multi-tenant subdomain routing)
      if (origin && /^https?:\/\/.*\.localhost:3000$/.test(origin)) {
        callback(null, true);
        return;
      }

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Versioning
  app.setGlobalPrefix('api/v1');

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const shutdown = async () => {
    await stopOpenTelemetry();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  console.log(`Application is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
