import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformHotelsController } from './platform-hotels.controller';
import { PlatformAnalyticsController } from './platform-analytics.controller';
import { PlatformSubscriptionsController } from './platform-subscriptions.controller';
import { PlatformFeatureFlagsController } from './platform-feature-flags.controller';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformService } from './platform.service';
import { GdprService } from './gdpr.service';
import { Hotel } from '../../database/entities/hotel.entity';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Subscription } from '../../database/entities/global/subscriptions.entity';
import { FeatureFlag } from '../../database/entities/global/feature-flag.entity';
import { GlobalSetting } from '../../database/entities/global/global-setting.entity';
import { AnalyticsSnapshot } from '../../database/entities/analytics-snapshot.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hotel,
      User,
      Booking,
      Subscription,
      FeatureFlag,
      AuditLog,
      GlobalSetting,
      AnalyticsSnapshot,
    ]),
  ],
  controllers: [
    PlatformHotelsController,
    PlatformAnalyticsController,
    PlatformSubscriptionsController,
    PlatformFeatureFlagsController,
    PlatformSettingsController,
  ],
  providers: [PlatformService, GdprService],
})
export class PlatformModule {}
