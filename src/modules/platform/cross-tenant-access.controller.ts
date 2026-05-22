import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CrossTenantAccessService } from './cross-tenant-access.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import {
  EmergencyAccessPriority,
  EmergencyAccessStatus,
} from '../../database/entities/global/emergency-access.entity';

@Controller('platform/access')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class CrossTenantAccessController {
  constructor(private readonly accessService: CrossTenantAccessService) {}

  // --- Impersonation ---

  @Post('impersonate')
  async startImpersonation(
    @Body('impersonatorId') impersonatorId: string,
    @Body('targetHotelId') targetHotelId: string,
    @Body('reason') reason: string,
  ) {
    return this.accessService.startImpersonation(
      impersonatorId,
      targetHotelId,
      reason,
    );
  }

  @Post('impersonate/:id/stop')
  async stopImpersonation(@Param('id') id: string) {
    return this.accessService.stopImpersonation(id);
  }

  @Get('impersonate')
  async getActiveImpersonations() {
    return this.accessService.getActiveImpersonations();
  }

  @Get('impersonate/history')
  async getImpersonationHistory(
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accessService.getImpersonationHistory(
      userId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // --- Emergency Access ---

  @Post('emergency')
  async requestEmergencyAccess(
    @Body('requestedBy') requestedBy: string,
    @Body('requesterEmail') requesterEmail: string,
    @Body('hotelId') hotelId: string,
    @Body('reason') reason: string,
    @Body('priority') priority: EmergencyAccessPriority,
    @Body('durationHours') durationHours: number,
  ) {
    return this.accessService.requestEmergencyAccess({
      requestedBy,
      requesterEmail,
      hotelId,
      reason,
      priority: priority || EmergencyAccessPriority.MEDIUM,
      durationHours: durationHours || 1,
    });
  }

  @Patch('emergency/:id/approve')
  async approveEmergencyAccess(
    @Param('id') id: string,
    @Body('approvedBy') approvedBy: string,
    @Body('approverEmail') approverEmail: string,
  ) {
    return this.accessService.approveEmergencyAccess(
      id,
      approvedBy,
      approverEmail,
    );
  }

  @Post('emergency/:id/activate')
  async activateEmergencyAccess(@Param('id') id: string) {
    return this.accessService.activateEmergencyAccess(id);
  }

  @Post('emergency/:id/revoke')
  async revokeEmergencyAccess(
    @Param('id') id: string,
    @Body('revokedBy') revokedBy: string,
    @Body('reason') reason: string,
  ) {
    return this.accessService.revokeEmergencyAccess(id, revokedBy, reason);
  }

  @Get('emergency')
  async getEmergencyAccessRequests(
    @Query('status') status?: EmergencyAccessStatus,
  ) {
    return this.accessService.getEmergencyAccessRequests(status);
  }

  @Get('emergency/pending')
  async getPendingEmergencyRequests() {
    return this.accessService.getPendingEmergencyRequests();
  }

  // --- Delegated Administration ---

  @Post('delegations')
  async createDelegation(
    @Body('delegateUserId') delegateUserId: string,
    @Body('delegateEmail') delegateEmail: string,
    @Body('delegatorUserId') delegatorUserId: string,
    @Body('delegatorEmail') delegatorEmail: string,
    @Body('hotelId') hotelId: string,
    @Body('reason') reason: string,
    @Body('delegatedPermissions') delegatedPermissions: string[],
    @Body('expiresInDays') expiresInDays?: number,
  ) {
    return this.accessService.createDelegation({
      delegateUserId,
      delegateEmail,
      delegatorUserId,
      delegatorEmail,
      hotelId,
      reason,
      delegatedPermissions,
      expiresInDays,
    });
  }

  @Post('delegations/:id/revoke')
  async revokeDelegation(
    @Param('id') id: string,
    @Body('revokedBy') revokedBy: string,
    @Body('reason') reason: string,
  ) {
    return this.accessService.revokeDelegation(id, revokedBy, reason);
  }

  @Get('delegations')
  async getDelegations(
    @Query('hotelId') hotelId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.accessService.getDelegations(hotelId, userId);
  }

  // --- Support Access ---

  @Post('support')
  async createSupportAccess(
    @Body('platformUserId') platformUserId: string,
    @Body('hotelId') hotelId: string,
    @Body('reason') reason: string,
    @Body('durationHours') durationHours: number,
  ) {
    return this.accessService.createSupportAccess({
      platformUserId,
      hotelId,
      reason,
      durationHours: durationHours || 1,
    });
  }

  @Post('support/:id/revoke')
  async revokeSupportAccess(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.accessService.revokeSupportAccess(id, reason);
  }

  @Get('support')
  async getActiveSupportAccess() {
    return this.accessService.getActiveSupportAccess();
  }
}
