import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageController } from './storage.controller';
import { StorageService, S3_CLIENT } from './storage.service';
import { TenantQuotaService } from '../../common/services/tenant-quota.service';
import { PlanLimitGuard } from '../../auth/guards/plan-limit.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const endpoint = configService.get<string>('S3_ENDPOINT');
        const accessKey = configService.get<string>('S3_ACCESS_KEY');
        const secretKey = configService.get<string>('S3_SECRET_KEY');

        return new S3Client({
          region: configService.get<string>('S3_REGION', 'us-east-1'),
          endpoint: endpoint || undefined,
          forcePathStyle: configService.get<boolean>(
            'S3_FORCE_PATH_STYLE',
            true,
          ),
          credentials:
            accessKey && secretKey
              ? {
                  accessKeyId: accessKey,
                  secretAccessKey: secretKey,
                }
              : undefined,
        });
      },
    },
    StorageService,
    TenantQuotaService,
    PlanLimitGuard,
  ],
  controllers: [StorageController],
  exports: [S3_CLIENT, StorageService],
})
export class StorageModule {}
