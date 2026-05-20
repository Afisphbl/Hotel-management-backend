import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const S3_CLIENT = 'S3_CLIENT';

@Injectable()
export class StorageService {
  private bucket: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3Client: S3Client,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
  }

  async putObject(params: {
    key: string;
    body: Buffer | Uint8Array | string;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        Metadata: params.metadata,
      }),
    );
  }

  async getPresignedPutUrl(params: {
    key: string;
    expiresInSeconds?: number;
    contentType?: string;
  }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: params.expiresInSeconds ?? 900,
    });
  }

  async getPresignedGetUrl(params: {
    key: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: params.expiresInSeconds ?? 900,
    });
  }

  getPublicUrl(key: string): string {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const forcePathStyle = this.configService.get<boolean>('S3_FORCE_PATH_STYLE', true);

    if (forcePathStyle && endpoint) {
      return `${endpoint.replace(/\/+$/, '')}/${this.bucket}/${key}`;
    }

    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
