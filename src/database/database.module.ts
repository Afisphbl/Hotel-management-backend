import { Module, Global, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Client } from 'pg';
import { getTenantSchema } from '../common/tenant/tenant-context';
import { ReplicaDataSourceService } from './replica-data-source.service';

@Injectable()
class TenantSearchPathService implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    const flaggedDataSource = this.dataSource as DataSource & {
      __tenantSearchPathPatched?: boolean;
    };

    if (flaggedDataSource.__tenantSearchPathPatched) {
      return;
    }

    flaggedDataSource.__tenantSearchPathPatched = true;
    const originalCreateQueryRunner = this.dataSource.createQueryRunner.bind(
      this.dataSource,
    );

    this.dataSource.createQueryRunner = (...args) => {
      const queryRunner = originalCreateQueryRunner(...args);
      const originalQuery = queryRunner.query.bind(queryRunner);
      let initialized = false;

      queryRunner.query = async (...queryArgs: any[]) => {
        if (!initialized) {
          initialized = true;
          const schema = getTenantSchema().replace(/"/g, '');
          await originalQuery(`SET search_path TO "${schema}", global, public`);
        }
        return originalQuery(...queryArgs);
      };

      return queryRunner;
    };
  }
}

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const dbConfig = {
          host: configService.getOrThrow<string>('DB_HOST'),
          port: configService.getOrThrow<number>('DB_PORT'),
          username: configService.getOrThrow<string>('DB_USERNAME'),
          password: configService.getOrThrow<string>('DB_PASSWORD'),
          database: configService.getOrThrow<string>('DB_NAME'),
        };

        if (configService.getOrThrow<boolean>('DB_SYNCHRONIZE')) {
          const client = new Client({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
          });
          await client.connect();
          await client.query('CREATE SCHEMA IF NOT EXISTS global');
          await client.end();
        }

        return {
          type: 'postgres',
          host: dbConfig.host,
          port: dbConfig.port,
          username: dbConfig.username,
          password: dbConfig.password,
          database: dbConfig.database,
          entities: [__dirname + '/entities/*.entity{.ts,.js}'],
          autoLoadEntities: true,
          synchronize: configService.getOrThrow<boolean>('DB_SYNCHRONIZE'),
          logging: configService.get<boolean>('DB_LOGGING', false),
          ssl: configService.get<boolean>('DB_SSL')
            ? { rejectUnauthorized: false }
            : undefined,
          retryAttempts: configService.get<number>('DB_RETRY_ATTEMPTS', 5),
          retryDelay: configService.get<number>('DB_RETRY_DELAY', 2000),
          maxQueryExecutionTime: configService.get<number>(
            'DB_MAX_QUERY_EXECUTION_TIME',
            5000,
          ),
          extra: {
            max: configService.get<number>('DB_POOL_SIZE', 20),
          },
        };
      },
    }),
  ],
  providers: [TenantSearchPathService, ReplicaDataSourceService],
  exports: [TypeOrmModule, ReplicaDataSourceService],
})
export class DatabaseModule {}
