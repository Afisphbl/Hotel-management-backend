import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

export interface ShardConfig {
  id: number;
  name: string;
  host: string;
  port: number;
  database: string;
  weight: number;
}

@Injectable()
export class ShardingService implements OnModuleInit {
  private readonly logger = new Logger(ShardingService.name);
  private shards: ShardConfig[] = [];
  private ring: number[] = [];
  private vnodes = 256;

  constructor(
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.initializeShards();
  }

  private initializeShards(): void {
    const shardConfigs = this.configService.get<string>('DB_SHARDS');
    if (!shardConfigs) {
      this.logger.log('No shard configuration found, running in single-database mode');
      return;
    }

    const entries = shardConfigs.split(';').map(s => s.trim()).filter(Boolean);
    for (const entry of entries) {
      const parts = entry.split(',');
      if (parts.length >= 3) {
        this.shards.push({
          id: parseInt(parts[0], 10),
          name: parts[1],
          host: parts[2],
          port: parseInt(parts[3] || '5432', 10),
          database: parts[4] || this.configService.get<string>('DB_NAME', 'hotel_booking'),
          weight: parseInt(parts[5] || '1', 10),
        });
      }
    }

    this.buildConsistentHashRing();
    this.logger.log(`Initialized ${this.shards.length} shard(s) with ${this.vnodes} virtual nodes`);
  }

  private buildConsistentHashRing(): void {
    this.ring = [];
    for (const shard of this.shards) {
      for (let i = 0; i < this.vnodes * shard.weight; i++) {
        const hash = this.hashValue(`${shard.name}:${i}`);
        this.ring.push(hash);
      }
    }
    this.ring.sort((a, b) => a - b);
  }

  private hashValue(key: string): number {
    const hash = createHash('md5').update(key).digest();
    return hash.readUInt32BE(0);
  }

  getShardForKey(key: string): ShardConfig | null {
    if (this.shards.length === 0) return null;
    if (this.shards.length === 1) return this.shards[0];

    const hash = this.hashValue(key);
    let low = 0;
    let high = this.ring.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.ring[mid] < hash) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    const ringIndex = low % this.ring.length;
    const shardIndex = ringIndex % this.shards.length;
    return this.shards[shardIndex];
  }

  getShardForTenant(hotelId: string): ShardConfig | null {
    return this.getShardForKey(`tenant:${hotelId}`);
  }

  getAllShards(): ShardConfig[] {
    return [...this.shards];
  }

  getShardCount(): number {
    return this.shards.length;
  }

  isShardingEnabled(): boolean {
    return this.shards.length > 0;
  }
}
