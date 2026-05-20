import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getTenantSchema } from '../common/tenant/tenant-context';

export interface ReplicaConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  poolSize: number;
  weight: number;
}

@Injectable()
export class ReplicaDataSourceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReplicaDataSourceService.name);
  private replicas: DataSource[] = [];
  private currentIndex = 0;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeReplicas();
  }

  private async initializeReplicas(): Promise<void> {
    const replicaHosts = this.configService.get<string>('DB_REPLICA_HOSTS');
    if (!replicaHosts) {
      this.logger.log(
        'No read replicas configured, using primary for all queries',
      );
      return;
    }

    const hosts = replicaHosts
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    const ports = (this.configService.get<string>('DB_REPLICA_PORTS') || '5432')
      .split(',')
      .map((p) => parseInt(p.trim(), 10));
    const weights = (this.configService.get<string>('DB_REPLICA_WEIGHTS') || '')
      .split(',')
      .map((w) => parseInt(w.trim(), 10));

    for (let i = 0; i < hosts.length; i++) {
      try {
        const replicaDs = new DataSource({
          type: 'postgres',
          host: hosts[i],
          port: ports[i] || 5432,
          username: this.configService.getOrThrow<string>('DB_USERNAME'),
          password: this.configService.getOrThrow<string>('DB_PASSWORD'),
          database: this.configService.getOrThrow<string>('DB_NAME'),
          schema: 'global',
          synchronize: false,
          logging: this.configService.get<boolean>('DB_LOGGING', false),
          ssl: this.configService.get<boolean>('DB_SSL')
            ? { rejectUnauthorized: false }
            : undefined,
          extra: {
            max: this.configService.get<number>('DB_REPLICA_POOL_SIZE', 10),
            application_name: `replica_${i}_${hosts[i]}`,
          },
        });

        const replica = await replicaDs.initialize();
        this.replicas.push(replica);
        this.logger.log(
          `Read replica connected: ${hosts[i]}:${ports[i] || 5432}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to connect read replica ${hosts[i]}: ${err.message}`,
        );
      }
    }

    this.logger.log(`${this.replicas.length} read replica(s) initialized`);
  }

  getReadDataSource(): DataSource | null {
    if (this.replicas.length === 0) return null;

    const replicaCount = this.replicas.length;
    if (replicaCount === 1) return this.replicas[0];

    this.currentIndex = (this.currentIndex + 1) % replicaCount;
    return this.replicas[this.currentIndex];
  }

  getReadDataSources(): DataSource[] {
    return [...this.replicas];
  }

  isHealthy(): boolean {
    return this.replicas.length > 0;
  }

  async onModuleDestroy(): Promise<void> {
    for (const replica of this.replicas) {
      try {
        await replica.destroy();
      } catch (err) {
        this.logger.error(
          `Error destroying replica connection: ${err.message}`,
        );
      }
    }
  }
}
