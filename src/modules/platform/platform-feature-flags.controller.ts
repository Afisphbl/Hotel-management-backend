import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { FeatureFlagStatus } from '../../database/entities/global/feature-flag.entity';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';

class CreateFeatureFlagDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() hotelId?: string;
  @IsOptional() @IsEnum(FeatureFlagStatus) status?: FeatureFlagStatus;
  @IsOptional() conditions?: Record<string, any>;
}

class UpdateFeatureFlagDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(FeatureFlagStatus) status?: FeatureFlagStatus;
  @IsOptional() conditions?: Record<string, any>;
}

@Controller('platform/feature-flags')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformFeatureFlagsController {
  constructor(private platformService: PlatformService) {}

  @Get()
  async findAll() {
    return this.platformService.findAllFeatureFlags();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.platformService.findFeatureFlagById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateFeatureFlagDto) {
    return this.platformService.createFeatureFlag(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateFeatureFlagDto) {
    return this.platformService.updateFeatureFlag(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.platformService.deleteFeatureFlag(id);
  }

  @Post(':id/toggle')
  async toggle(@Param('id') id: string) {
    return this.platformService.toggleFeatureFlag(id);
  }
}
