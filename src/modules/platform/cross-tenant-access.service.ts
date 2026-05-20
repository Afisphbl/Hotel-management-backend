import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThan } from 'typeorm';
import { PlatformUser, UserStatus } from '../../database/entities/global';
import { Hotel } from '../../database/entities/hotel.entity';
import {
  ImpersonationLog,
  ImpersonationStatus,
} from '../../database/entities/global/impersonation-log.entity';
import {
  EmergencyAccess,
  EmergencyAccessStatus,
  EmergencyAccessPriority,
} from '../../database/entities/global/emergency-access.entity';
import {
  DelegatedAdmin,
  DelegatedAdminStatus,
} from '../../database/entities/global/delegated-admin.entity';
import {
  SupportAccess,
  SupportAccessStatus,
} from '../../database/entities/global/support-access.entity';
import {
  AuditLog,
  AuditAction,
  AuditResource,
} from '../../database/entities/audit-log.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CrossTenantAccessService {
  private readonly logger = new Logger(CrossTenantAccessService.name);

  constructor(
    private dataSource: DataSource,
    @InjectRepository(PlatformUser)
    private userRepository: Repository<PlatformUser>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(ImpersonationLog)
    private impersonationRepository: Repository<ImpersonationLog>,
    @InjectRepository(EmergencyAccess)
    private emergencyAccessRepository: Repository<EmergencyAccess>,
    @InjectRepository(DelegatedAdmin)
    private delegatedAdminRepository: Repository<DelegatedAdmin>,
    @InjectRepository(SupportAccess)
    private supportAccessRepository: Repository<SupportAccess>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private redisService: RedisService,
  ) {}

  // --- Impersonation ---

  async startImpersonation(
    impersonatorId: string,
    targetHotelId: string,
    reason: string,
  ): Promise<{
    session: ImpersonationLog;
    token: string;
  }> {
    const impersonator = await this.userRepository.findOne({
      where: { id: impersonatorId },
    });
    if (!impersonator) throw new NotFoundException('Impersonator not found');

    const hotel = await this.hotelRepository.findOne({
      where: { id: targetHotelId },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const activeSessions = await this.impersonationRepository.count({
      where: {
        impersonatorId,
        status: ImpersonationStatus.ACTIVE,
      },
    });

    if (activeSessions >= 3) {
      throw new ForbiddenException(
        'Maximum active impersonation sessions reached (3)',
      );
    }

    const session = this.impersonationRepository.create({
      impersonatorId,
      impersonatorEmail: impersonator.email,
      targetHotelId,
      targetHotelName: hotel.name,
      reason,
      startedAt: new Date(),
      status: ImpersonationStatus.ACTIVE,
      metadata: {
        impersonatorRole: impersonator.role?.name || 'unknown',
        hotelSchema: hotel.schemaName,
      },
    });
    const saved = await this.impersonationRepository.save(session);

    await this.logAudit(
      AuditAction.IMPERSONATION_START,
      impersonatorId,
      targetHotelId,
      {
        sessionId: saved.id,
        reason,
        hotelName: hotel.name,
      },
    );

    const token = Buffer.from(
      JSON.stringify({
        type: 'impersonation',
        sessionId: saved.id,
        impersonatorId,
        hotelId: targetHotelId,
        exp: Date.now() + 3600000,
      }),
    ).toString('base64');

    await this.redisService.set(
      `impersonation:${saved.id}`,
      JSON.stringify({
        impersonatorId,
        hotelId: targetHotelId,
        startedAt: saved.startedAt,
      }),
      3600,
    );

    return { session: saved, token };
  }

  async stopImpersonation(sessionId: string): Promise<ImpersonationLog> {
    const session = await this.impersonationRepository.findOne({
      where: { id: sessionId },
    });
    if (!session)
      throw new NotFoundException('Impersonation session not found');

    session.status = ImpersonationStatus.COMPLETED;
    session.endedAt = new Date();
    const saved = await this.impersonationRepository.save(session);

    await this.redisService.del(`impersonation:${sessionId}`);

    await this.logAudit(
      AuditAction.IMPERSONATION_STOP,
      session.impersonatorId,
      session.targetHotelId,
      {
        sessionId,
        duration: session.endedAt.getTime() - session.startedAt.getTime(),
      },
    );

    return saved;
  }

  async getActiveImpersonations(): Promise<ImpersonationLog[]> {
    return this.impersonationRepository.find({
      where: { status: ImpersonationStatus.ACTIVE },
      order: { startedAt: 'DESC' },
    });
  }

  async getImpersonationHistory(
    userId?: string,
    limit = 50,
  ): Promise<ImpersonationLog[]> {
    const where: any = {};
    if (userId) where.impersonatorId = userId;
    return this.impersonationRepository.find({
      where,
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  async isImpersonating(sessionId: string): Promise<boolean> {
    const cached = await this.redisService.get(`impersonation:${sessionId}`);
    return cached !== null;
  }

  // --- Emergency Access ---

  async requestEmergencyAccess(data: {
    requestedBy: string;
    requesterEmail: string;
    hotelId: string;
    reason: string;
    priority: EmergencyAccessPriority;
    durationHours: number;
  }): Promise<EmergencyAccess> {
    const hotel = await this.hotelRepository.findOne({
      where: { id: data.hotelId },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const activeRequests = await this.emergencyAccessRepository.count({
      where: {
        requestedBy: data.requestedBy,
        status: EmergencyAccessStatus.ACTIVE,
      },
    });

    if (activeRequests >= 2) {
      throw new ForbiddenException(
        'Maximum active emergency access requests reached (2)',
      );
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + data.durationHours);

    const access = this.emergencyAccessRepository.create({
      requestedBy: data.requestedBy,
      requesterEmail: data.requesterEmail,
      hotelId: data.hotelId,
      hotelName: hotel.name,
      reason: data.reason,
      priority: data.priority,
      status: EmergencyAccessStatus.REQUESTED,
      expiresAt,
      metadata: {
        hotelSchema: hotel.schemaName,
        requestedAt: new Date().toISOString(),
      },
    });

    const saved = await this.emergencyAccessRepository.save(access);

    await this.logAudit(
      AuditAction.EMERGENCY_REQUEST,
      data.requestedBy,
      data.hotelId,
      {
        accessId: saved.id,
        reason: data.reason,
        priority: data.priority,
        expiresAt,
      },
    );

    return saved;
  }

  async approveEmergencyAccess(
    accessId: string,
    approvedBy: string,
    approverEmail: string,
  ): Promise<EmergencyAccess> {
    const access = await this.emergencyAccessRepository.findOne({
      where: { id: accessId },
    });
    if (!access)
      throw new NotFoundException('Emergency access request not found');
    if (access.status !== EmergencyAccessStatus.REQUESTED) {
      throw new BadRequestException('Access request is not in requested state');
    }

    access.status = EmergencyAccessStatus.APPROVED;
    access.approvedBy = approvedBy;
    access.approverEmail = approverEmail;
    access.approvedAt = new Date();
    const saved = await this.emergencyAccessRepository.save(access);

    await this.logAudit(
      AuditAction.EMERGENCY_APPROVE,
      approvedBy,
      access.hotelId,
      {
        accessId,
        requestedBy: access.requestedBy,
      },
    );

    return saved;
  }

  async activateEmergencyAccess(accessId: string): Promise<EmergencyAccess> {
    const access = await this.emergencyAccessRepository.findOne({
      where: { id: accessId },
    });
    if (!access)
      throw new NotFoundException('Emergency access request not found');
    if (access.status !== EmergencyAccessStatus.APPROVED) {
      throw new BadRequestException(
        'Access must be approved before activation',
      );
    }
    if (new Date() > access.expiresAt) {
      access.status = EmergencyAccessStatus.EXPIRED;
      await this.emergencyAccessRepository.save(access);
      throw new BadRequestException('Access request has expired');
    }

    access.status = EmergencyAccessStatus.ACTIVE;
    access.accessedAt = new Date();
    const saved = await this.emergencyAccessRepository.save(access);

    await this.redisService.set(
      `emergency:${access.hotelId}:${access.requestedBy}`,
      JSON.stringify({ accessId, expiresAt: access.expiresAt }),
      Math.ceil((access.expiresAt.getTime() - Date.now()) / 1000),
    );

    await this.logAudit(
      AuditAction.EMERGENCY_ACTIVATE,
      access.requestedBy,
      access.hotelId,
      {
        accessId,
        expiresAt: access.expiresAt,
      },
    );

    return saved;
  }

  async revokeEmergencyAccess(
    accessId: string,
    revokedBy: string,
    reason: string,
  ): Promise<EmergencyAccess> {
    const access = await this.emergencyAccessRepository.findOne({
      where: { id: accessId },
    });
    if (!access)
      throw new NotFoundException('Emergency access request not found');
    if (
      access.status === EmergencyAccessStatus.REVOKED ||
      access.status === EmergencyAccessStatus.EXPIRED
    ) {
      throw new BadRequestException('Access already revoked or expired');
    }

    access.status = EmergencyAccessStatus.REVOKED;
    access.revokedAt = new Date();
    access.revocationReason = reason;
    const saved = await this.emergencyAccessRepository.save(access);

    await this.redisService.del(
      `emergency:${access.hotelId}:${access.requestedBy}`,
    );

    await this.logAudit(
      AuditAction.EMERGENCY_REVOKE,
      revokedBy,
      access.hotelId,
      {
        accessId,
        reason,
      },
    );

    return saved;
  }

  async getEmergencyAccessRequests(
    status?: EmergencyAccessStatus,
  ): Promise<EmergencyAccess[]> {
    const where: any = {};
    if (status) where.status = status;
    return this.emergencyAccessRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingEmergencyRequests(): Promise<EmergencyAccess[]> {
    const expired = await this.emergencyAccessRepository.find({
      where: {
        status: EmergencyAccessStatus.REQUESTED,
        expiresAt: LessThan(new Date()),
      },
    });
    for (const e of expired) {
      e.status = EmergencyAccessStatus.EXPIRED;
      await this.emergencyAccessRepository.save(e);
    }

    return this.emergencyAccessRepository.find({
      where: { status: EmergencyAccessStatus.REQUESTED },
      order: { createdAt: 'DESC' },
    });
  }

  async validateEmergencyAccess(
    userId: string,
    hotelId: string,
  ): Promise<boolean> {
    const cached = await this.redisService.get(
      `emergency:${hotelId}:${userId}`,
    );
    if (cached) {
      const data = JSON.parse(cached);
      if (new Date(data.expiresAt) > new Date()) return true;
      await this.redisService.del(`emergency:${hotelId}:${userId}`);
    }

    const active = await this.emergencyAccessRepository.findOne({
      where: {
        requestedBy: userId,
        hotelId,
        status: EmergencyAccessStatus.ACTIVE,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (active) {
      const ttl = Math.ceil((active.expiresAt.getTime() - Date.now()) / 1000);
      await this.redisService.set(
        `emergency:${hotelId}:${userId}`,
        JSON.stringify({ accessId: active.id, expiresAt: active.expiresAt }),
        ttl,
      );
      return true;
    }

    return false;
  }

  // --- Delegated Administration ---

  async createDelegation(data: {
    delegateUserId: string;
    delegateEmail: string;
    delegatorUserId: string;
    delegatorEmail: string;
    hotelId: string;
    reason: string;
    delegatedPermissions: string[];
    expiresInDays?: number;
  }): Promise<DelegatedAdmin> {
    const hotel = await this.hotelRepository.findOne({
      where: { id: data.hotelId },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const existing = await this.delegatedAdminRepository.findOne({
      where: {
        delegateUserId: data.delegateUserId,
        hotelId: data.hotelId,
        status: DelegatedAdminStatus.ACTIVE,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Active delegation already exists for this user and hotel',
      );
    }

    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86400000)
      : null;

    const delegation = this.delegatedAdminRepository.create({
      delegateUserId: data.delegateUserId,
      delegateEmail: data.delegateEmail,
      delegatorUserId: data.delegatorUserId,
      delegatorEmail: data.delegatorEmail,
      hotelId: data.hotelId,
      hotelName: hotel.name,
      reason: data.reason,
      delegatedPermissions: data.delegatedPermissions,
      expiresAt,
      status: DelegatedAdminStatus.ACTIVE,
    });

    const saved = await this.delegatedAdminRepository.save(delegation);

    await this.logAudit(
      AuditAction.DELEGATION_CREATE,
      data.delegatorUserId,
      data.hotelId,
      {
        delegationId: saved.id,
        delegateUserId: data.delegateUserId,
        delegateEmail: data.delegateEmail,
        permissions: data.delegatedPermissions,
        expiresAt,
      },
    );

    return saved;
  }

  async revokeDelegation(
    delegationId: string,
    revokedBy: string,
    reason: string,
  ): Promise<DelegatedAdmin> {
    const delegation = await this.delegatedAdminRepository.findOne({
      where: { id: delegationId },
    });
    if (!delegation) throw new NotFoundException('Delegation not found');

    delegation.status = DelegatedAdminStatus.REVOKED;
    delegation.revokedAt = new Date();
    delegation.revocationReason = reason;
    const saved = await this.delegatedAdminRepository.save(delegation);

    await this.logAudit(
      AuditAction.DELEGATION_REVOKE,
      revokedBy,
      delegation.hotelId,
      {
        delegationId,
        reason,
      },
    );

    return saved;
  }

  async getDelegations(
    hotelId?: string,
    userId?: string,
  ): Promise<DelegatedAdmin[]> {
    const where: any = {};
    if (hotelId) where.hotelId = hotelId;
    if (userId) where.delegateUserId = userId;
    return this.delegatedAdminRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getDelegatedPermissions(
    userId: string,
    hotelId: string,
  ): Promise<string[]> {
    const active = await this.delegatedAdminRepository.findOne({
      where: {
        delegateUserId: userId,
        hotelId,
        status: DelegatedAdminStatus.ACTIVE,
      },
    });

    if (!active) return [];
    if (active.expiresAt && new Date() > active.expiresAt) {
      active.status = DelegatedAdminStatus.EXPIRED;
      await this.delegatedAdminRepository.save(active);
      return [];
    }

    return active.delegatedPermissions;
  }

  async expireDelegations(): Promise<number> {
    const result = await this.delegatedAdminRepository
      .createQueryBuilder()
      .update(DelegatedAdmin)
      .set({ status: DelegatedAdminStatus.EXPIRED })
      .where('status = :status', { status: DelegatedAdminStatus.ACTIVE })
      .andWhere('expiresAt IS NOT NULL')
      .andWhere('expiresAt < :now', { now: new Date() })
      .execute();
    return result.affected || 0;
  }

  // --- Support Access ---

  async createSupportAccess(data: {
    platformUserId: string;
    hotelId: string;
    reason: string;
    durationHours: number;
  }): Promise<SupportAccess> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + data.durationHours);

    const access = this.supportAccessRepository.create({
      platformUserId: data.platformUserId,
      hotelId: data.hotelId,
      reason: data.reason,
      expiresAt,
      status: SupportAccessStatus.ACTIVE,
    });

    const saved = await this.supportAccessRepository.save(access);

    await this.logAudit(
      AuditAction.SUPPORT_ACCESS_GRANT,
      data.platformUserId,
      data.hotelId,
      {
        accessId: saved.id,
        durationHours: data.durationHours,
        expiresAt,
      },
    );

    return saved;
  }

  async revokeSupportAccess(
    accessId: string,
    reason?: string,
  ): Promise<SupportAccess> {
    const access = await this.supportAccessRepository.findOne({
      where: { id: accessId },
    });
    if (!access) throw new NotFoundException('Support access not found');

    access.status = SupportAccessStatus.REVOKED;
    access.revokedAt = new Date();
    if (reason) {
      access.metadata = {
        ...(access.metadata || {}),
        revocationReason: reason,
      };
    }
    return this.supportAccessRepository.save(access);
  }

  async getActiveSupportAccess(): Promise<SupportAccess[]> {
    return this.supportAccessRepository.find({
      where: { status: SupportAccessStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async expireSupportAccess(): Promise<number> {
    const result = await this.supportAccessRepository
      .createQueryBuilder()
      .update(SupportAccess)
      .set({ status: SupportAccessStatus.EXPIRED })
      .where('status = :status', { status: SupportAccessStatus.ACTIVE })
      .andWhere('expiresAt < :now', { now: new Date() })
      .execute();
    return result.affected || 0;
  }

  // --- Audit Trail ---

  private async logAudit(
    action: AuditAction,
    userId: string,
    hotelId: string | null,
    metadata: any,
  ) {
    try {
      const log = this.auditLogRepository.create({
        action,
        performedBy: userId,
        hotelId: hotelId || undefined,
        resourceType: AuditResource.CROSS_TENANT_ACCESS,
        metadata,
      });
      await this.auditLogRepository.save(log);
    } catch (err) {
      this.logger.error(`Failed to log audit: ${err.message}`);
    }
  }
}
