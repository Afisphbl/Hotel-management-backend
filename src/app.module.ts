import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { UsersModule } from './modules/users/users.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { BookingsModule } from './modules/bookings/bookings.module';
import { HotelModule } from './modules/hotel/hotel.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PlatformModule } from './modules/platform/platform.module';
import { WorkersModule } from './modules/workers/workers.module';
import { validateEnv } from './config/env.validation';
import { RedisModule } from './modules/redis/redis.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { StorageModule } from './modules/storage/storage.module';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { MaintenanceMiddleware } from './common/middleware/maintenance.middleware';
import { JwtModule, JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        redact: ['req.headers.authorization', 'req.body.password'],
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.getOrThrow<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: configService.get<number>('REDIS_DB', 0),
          tls: configService.get<boolean>('REDIS_TLS')
            ? { rejectUnauthorized: false }
            : undefined,
        },
        prefix: 'hotel-mgmt',
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      }),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRATION'),
        },
      }),
    }),
    DatabaseModule,
    RedisModule,
    ObservabilityModule,
    StorageModule,
    AuthModule,
    HotelsModule,
    UsersModule,
    BookingsModule,
    HotelModule,
    FinanceModule,
    PlatformModule,
    WorkersModule,
  ],
  providers: [RateLimitMiddleware, MaintenanceMiddleware],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MaintenanceMiddleware)
      .forRoutes({ path: 'api/*', method: RequestMethod.ALL });

    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });

    // Apply rate limiting to all API routes
    // Note: RateLimitMiddleware needs to be used as a class, not instantiated manually
    // The middleware configuration will be handled by applying the middleware class
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes({ path: 'api/*', method: RequestMethod.ALL });
  }
}
