import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { GdprService } from './gdpr.service';
import { PasswordPolicyService } from '../../common/services/password-policy.service';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

class PasswordPolicyDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  minLength?: number;
  @IsOptional()
  @IsBoolean()
  requireUppercase?: boolean;
  @IsOptional()
  @IsBoolean()
  requireLowercase?: boolean;
  @IsOptional()
  @IsBoolean()
  requireNumber?: boolean;
  @IsOptional()
  @IsBoolean()
  requireSymbol?: boolean;
}

@Controller('platform/compliance')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformComplianceController {
  constructor(
    private readonly gdprService: GdprService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  @Get('password-policy')
  async getPasswordPolicy() {
    return this.passwordPolicyService.getPolicy();
  }

  @Patch('password-policy')
  async updatePasswordPolicy(@Body() dto: PasswordPolicyDto) {
    return this.passwordPolicyService.updatePolicy(dto);
  }

  @Get('retention-policy')
  async getRetentionPolicy() {
    return this.gdprService.getRetentionPolicy();
  }

  @Patch('retention-policy')
  async updateRetentionPolicy(@Body() dto: Record<string, any>) {
    return this.gdprService.updateRetentionPolicy(dto);
  }

  @Get('gdpr/export/:userId')
  async exportUserData(@Param('userId') userId: string) {
    return this.gdprService.exportUserData(userId);
  }

  @Post('gdpr/anonymize/:userId')
  async anonymizeUser(@Param('userId') userId: string) {
    return this.gdprService.anonymizeUser(userId);
  }
}
