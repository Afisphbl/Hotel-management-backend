import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { ConsentService } from './consent.service';
import { ConsentType } from '../../database/entities/global/consent-record.entity';
import { GdprService } from './gdpr.service';

@Controller('platform/privacy')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformConsentController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly gdprService: GdprService,
  ) {}

  @Get('consents/:userId')
  async getUserConsents(@Param('userId') userId: string) {
    return this.consentService.getUserConsents(userId);
  }

  @Get('consents/:userId/summary')
  async getConsentSummary(@Param('userId') userId: string) {
    return this.consentService.getConsentSummary(userId);
  }

  @Post('consents')
  @HttpCode(HttpStatus.CREATED)
  async recordConsent(
    @Body()
    data: {
      userId: string;
      hotelId?: string;
      type: ConsentType;
      granted: boolean;
      ipAddress?: string;
      userAgent?: string;
      policyVersion?: string;
    },
  ) {
    return this.consentService.recordConsent(data);
  }

  @Post('consents/:userId/revoke/:type')
  @HttpCode(HttpStatus.OK)
  async revokeConsent(
    @Param('userId') userId: string,
    @Param('type') type: ConsentType,
  ) {
    await this.consentService.revokeConsent(userId, type);
    return { success: true };
  }

  @Get('consents/:userId/check/:type')
  async checkConsent(
    @Param('userId') userId: string,
    @Param('type') type: ConsentType,
  ) {
    const granted = await this.consentService.hasConsent(userId, type);
    return { userId, type, granted };
  }

  @Get('data-retention')
  async getDataRetention() {
    return this.gdprService.getRetentionPolicy();
  }

  @Post('data-retention')
  @HttpCode(HttpStatus.OK)
  async updateDataRetention(@Body() policy: any) {
    return this.gdprService.updateRetentionPolicy(policy);
  }

  @Post('cleanup-expired-consents')
  @HttpCode(HttpStatus.OK)
  async cleanupExpired() {
    const count = await this.consentService.cleanupExpiredConsents();
    return { cleaned: count };
  }
}
