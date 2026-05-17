import { Module, Global } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/entities/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        logging: configService.get<boolean>('DB_LOGGING'),
      }),
    }),
  ],
  providers: [
    {
      provide: 'TENANT_CONNECTION',
      inject: [REQUEST, DataSource],
      useFactory: async (request: Request, dataSource: DataSource) => {
        const tenantSchema = request['tenant_schema'];
        if (tenantSchema) {
          // In a real production app, you might want to use a pool of connections 
          // or a more sophisticated way to handle search_path per request.
          // For TypeORM, one common way is to set search_path on the query runner.
          // However, for simplicity and to follow the requirement of 'middleware sets PostgreSQL search_path',
          // we can provide a proxied DataSource or use a custom repository approach.
          
          // Here we return a simple object or the dataSource itself if we handle search_path elsewhere.
          // Better approach for NestJS: Use a Request-scoped provider that configures the EntityManager.
          return dataSource; 
        }
        return dataSource;
      },
    },
  ],
  exports: ['TENANT_CONNECTION'],
})
export class DatabaseModule {}
