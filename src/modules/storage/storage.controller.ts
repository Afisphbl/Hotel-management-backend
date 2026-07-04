import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SuspensionGuard } from '../../common/guards/suspension.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PlanLimitGuard } from '../../auth/guards/plan-limit.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { PlanLimit } from '../../common/decorators/plan-limit.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { TenantQuotaService } from '../../common/services/tenant-quota.service';

class UploadUrlDto {
  @IsString()
  key: string;

  @IsNumber()
  @Min(0.01)
  sizeMb: number;

  @IsOptional()
  @IsString()
  contentType?: string;
}

class StorageUsageDto {
  @IsNumber()
  @Min(0.01)
  sizeMb: number;
}

@Controller('hotel/storage')
@UseGuards(
  JwtAuthGuard,
  ScopeGuard,
  TenantGuard,
  SuspensionGuard,
  PermissionsGuard,
  PlanLimitGuard,
)
@Scopes(UserScope.HOTEL)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly tenantQuotaService: TenantQuotaService,
  ) {}

  @Post('presign')
  @PlanLimit('storage')
  async createPresignedUploadUrl(
    @Body() dto: UploadUrlDto,
    @Request() req: any,
  ) {
    const hotelId = req.user.hotel_id;
    // Sanitize key to prevent path traversal and enforce tenant isolation
    // Split by slash and filter out any path traversal segments
    const sanitizedKey = dto.key
      .split(/[/\\]/)
      .map((segment) => segment.replace(/\.+/g, (match) => (match.length > 1 ? '' : match)))
      .filter((segment) => segment && segment !== '.')
      .join('/')
      .replace(/^\/+/, ''); // Ensure no leading slashes after join

    const finalKey = `hotels/${hotelId}/${sanitizedKey}`;

    const url = await this.storageService.getPresignedPutUrl({
      key: finalKey,
      contentType: dto.contentType,
    });

    return {
      uploadUrl: url,
      key: finalKey,
      sizeMb: dto.sizeMb,
      hotelId,
    };
  }

  @Post('usage')
  @HttpCode(HttpStatus.OK)
  @PlanLimit('storage')
  async recordUsage(@Body() dto: StorageUsageDto, @Request() req: any) {
    const hotelId = req.user.hotel_id;
    const hotel = await this.tenantQuotaService.reserveStorage(
      hotelId,
      dto.sizeMb,
    );

    return {
      hotelId: hotel.id,
      storageUsedMb: hotel.storageUsedMb,
    };
  }
}
