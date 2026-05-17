import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { startOpenTelemetry, stopOpenTelemetry } from './observability/otel';

async function bootstrap() {
  await startOpenTelemetry();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino for logging
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

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
