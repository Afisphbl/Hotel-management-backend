import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

export interface CdnConfig {
  enabled: boolean;
  provider: 'cloudfront' | 'cloudflare' | 'fastly' | 'custom';
  baseUrl: string;
  distributionId?: string;
  apiToken?: string;
  zoneId?: string;
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  blur?: number;
  sharpen?: number;
}

@Injectable()
export class CdnService {
  private readonly logger = new Logger(CdnService.name);
  private config: CdnConfig | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    const cdnUrl = this.configService.get<string>('CDN_URL');
    const cdnProvider = this.configService.get<string>(
      'CDN_PROVIDER',
      'cloudfront',
    );
    const cdnDistributionId = this.configService.get<string>(
      'CDN_DISTRIBUTION_ID',
    );
    const cdnApiToken = this.configService.get<string>('CDN_API_TOKEN');
    const cdnZoneId = this.configService.get<string>('CDN_ZONE_ID');

    if (cdnUrl) {
      this.config = {
        enabled: true,
        provider: cdnProvider as CdnConfig['provider'],
        baseUrl: cdnUrl.replace(/\/+$/, ''),
        distributionId: cdnDistributionId,
        apiToken: cdnApiToken,
        zoneId: cdnZoneId,
      };
      this.logger.log(
        `CDN enabled: ${this.config.provider} - ${this.config.baseUrl}`,
      );
    }
  }

  isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  getBaseUrl(): string {
    return this.config?.baseUrl ?? '';
  }

  getCdnUrl(key: string, transform?: ImageTransformOptions): string {
    if (!this.config?.enabled) {
      return this.storageService.getPublicUrl(key);
    }

    const baseUrl = this.config.baseUrl;
    let url = `${baseUrl}/${key}`;

    if (transform && this.config.provider === 'cloudflare') {
      const params = new URLSearchParams();
      if (transform.width) params.set('width', String(transform.width));
      if (transform.height) params.set('height', String(transform.height));
      if (transform.fit) params.set('fit', transform.fit);
      if (transform.quality) params.set('quality', String(transform.quality));
      if (transform.format) params.set('format', transform.format);
      if (transform.blur) params.set('blur', String(transform.blur));
      if (transform.sharpen) params.set('sharpen', String(transform.sharpen));

      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    return url;
  }

  async purgeCache(
    paths: string[],
  ): Promise<{ success: boolean; purged: number }> {
    if (!this.config?.enabled) {
      return { success: false, purged: 0 };
    }
    this.logger.log(
      `Cache purge requested for ${paths.length} path(s) on ${this.config.provider}`,
    );

    if (this.config.distributionId) {
      return this.purgeCloudFront(paths);
    }

    this.logger.warn('CDN cache purge requires distribution ID configuration');
    return { success: false, purged: 0 };
  }

  async purgeByPrefix(
    prefix: string,
  ): Promise<{ success: boolean; purged: number }> {
    return this.purgeCache([`${prefix}*`]);
  }

  private async purgeCloudFront(
    paths: string[],
  ): Promise<{ success: boolean; purged: number }> {
    const distributionId = this.config!.distributionId;
    this.logger.log(
      `CloudFront invalidation requested for ${paths.length} paths via distribution ${distributionId}`,
    );
    try {
      const cfModule = require('@aws-sdk/client-cloudfront');
      const client = new cfModule.CloudFrontClient({
        region: this.configService.get('S3_REGION', 'us-east-1'),
      });
      await client.send(
        new cfModule.CreateInvalidationCommand({
          DistributionId: distributionId,
          InvalidationBatch: {
            CallerReference: `invalidation-${Date.now()}`,
            Paths: {
              Quantity: paths.length,
              Items: paths.map((p) => (p.startsWith('/') ? p : `/${p}`)),
            },
          },
        }),
      );
      return { success: true, purged: paths.length };
    } catch {
      return { success: false, purged: 0 };
    }
  }
}
