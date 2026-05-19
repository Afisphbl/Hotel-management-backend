import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleInit(): Promise<void> {
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(...keys: string[]): Promise<void> {
    await this.client.del(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }
}
