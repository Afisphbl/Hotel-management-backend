import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const S3_CLIENT = 'S3_CLIENT';

@Injectable()
export class StorageService {
  constructor(
    @Inject(S3_CLIENT) private readonly s3Client: S3Client,
    private readonly configService: ConfigService,
  ) {}

  async putObject(params: {
    key: string;
    body: Buffer | Uint8Array | string;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    const bucket = this.configService.getOrThrow<string>('S3_BUCKET');

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
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
    const bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      ContentType: params.contentType,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: params.expiresInSeconds ?? 900,
    });
  }
}
