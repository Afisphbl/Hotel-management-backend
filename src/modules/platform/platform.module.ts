import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformHotelsController } from './platform-hotels.controller';
import { PlatformAnalyticsController } from './platform-analytics.controller';
import { PlatformSubscriptionsController } from './platform-subscriptions.controller';
import { PlatformFeatureFlagsController } from './platform-feature-flags.controller';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformMonitoringController } from './platform-monitoring.controller';
import { PlatformComplianceController } from './platform-compliance.controller';
import { PlatformQuotaController } from './platform-quota.controller';
import { CrossTenantAccessController } from './cross-tenant-access.controller';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformTaxRulesController } from './platform-tax-rules.controller';
import { PlatformLocalesController } from './platform-locales.controller';
import { PlatformUsersManagementController } from './platform-users-management.controller';
import { PlatformConsentController } from './platform-consent.controller';
import { PlatformAnalyticsExportController } from './platform-analytics-export.controller';
import { PlatformService } from './platform.service';
import { GdprService } from './gdpr.service';
import { RevenueAnalyticsService } from './revenue-analytics.service';
import { SystemMonitoringService } from './system-monitoring.service';
import { CrossTenantAccessService } from './cross-tenant-access.service';
import { SmtpService } from './smtp.service';
import { TaxRuleService } from './tax-rule.service';
import { LocaleService } from './locale.service';
import { UserManagementService } from './user-management.service';
import { ConsentService } from './consent.service';
import { FeatureFlagEvaluationService } from './feature-flag-evaluation.service';
import { AnalyticsExportService } from './analytics-export.service';
import { CustomReportService } from './custom-report.service';
import { PasswordPolicyService } from '../../common/services/password-policy.service';
import { PaymentGatewayService } from '../../common/services/payment-gateway.service';
import { TenantQuotaService } from '../../common/services/tenant-quota.service';
import { RedisService } from '../redis/redis.service';
import { Hotel } from '../../database/entities/hotel.entity';
import { Hotel as GlobalHotel } from '../../database/entities/global/hotel.entity';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Subscription } from '../../database/entities/global/subscriptions.entity';
import { FeatureFlag } from '../../database/entities/global/feature-flag.entity';
import { GlobalSetting } from '../../database/entities/global/global-setting.entity';
import { AnalyticsSnapshot } from '../../database/entities/analytics-snapshot.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import {
  PlatformUser,
  Role,
  Permission,
  RolePermission,
  HotelUserAccess,
} from '../../database/entities/global';
import { SupportAccess } from '../../database/entities/global/support-access.entity';
import { TenantQuota } from '../../database/entities/global/tenant-quota.entity';
import { OverageBilling } from '../../database/entities/global/overage-billing.entity';
import { QuotaAlert } from '../../database/entities/global/quota-alert.entity';
import { UptimeRecord } from '../../database/entities/global/uptime-record.entity';
import { MaintenanceWindow } from '../../database/entities/global/maintenance-window.entity';
import { ImpersonationLog } from '../../database/entities/global/impersonation-log.entity';
import { EmergencyAccess } from '../../database/entities/global/emergency-access.entity';
import { DelegatedAdmin } from '../../database/entities/global/delegated-admin.entity';
import { PlatformTaxRule } from '../../database/entities/global/platform-tax-rule.entity';
import { LocaleSetting } from '../../database/entities/global/locale-setting.entity';
import { ConsentRecord } from '../../database/entities/global/consent-record.entity';
import { CustomReport } from '../../database/entities/global/custom-report.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hotel,
      GlobalHotel,
      User,
      Booking,
      Subscription,
      FeatureFlag,
      AuditLog,
      GlobalSetting,
      AnalyticsSnapshot,
      PlatformUser,
      Role,
      Permission,
      RolePermission,
      HotelUserAccess,
      SupportAccess,
      TenantQuota,
      OverageBilling,
      QuotaAlert,
      UptimeRecord,
      MaintenanceWindow,
      ImpersonationLog,
      EmergencyAccess,
      DelegatedAdmin,
      PlatformTaxRule,
      LocaleSetting,
      ConsentRecord,
      CustomReport,
    ]),
  ],
  controllers: [
    PlatformHotelsController,
    PlatformAnalyticsController,
    PlatformSubscriptionsController,
    PlatformFeatureFlagsController,
    PlatformSettingsController,
    PlatformMonitoringController,
    PlatformComplianceController,
    PlatformQuotaController,
    CrossTenantAccessController,
    PlatformConfigController,
    PlatformTaxRulesController,
    PlatformLocalesController,
    PlatformUsersManagementController,
    PlatformConsentController,
    PlatformAnalyticsExportController,
  ],
  providers: [
    PlatformService,
    GdprService,
    RevenueAnalyticsService,
    SystemMonitoringService,
    CrossTenantAccessService,
    SmtpService,
    TaxRuleService,
    LocaleService,
    UserManagementService,
    ConsentService,
    FeatureFlagEvaluationService,
    AnalyticsExportService,
    CustomReportService,
    PasswordPolicyService,
    PaymentGatewayService,
    TenantQuotaService,
    RedisService,
  ],
})
export class PlatformModule {}
