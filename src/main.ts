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
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
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
