import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import {
  FeatureFlagEvaluationService,
  EvaluationContext,
} from './feature-flag-evaluation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import {
  FeatureFlagStatus,
  FeatureFlagRolloutStrategy,
} from '../../database/entities/global/feature-flag.entity';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

class CreateFeatureFlagDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() hotelId?: string;
  @IsOptional() @IsEnum(FeatureFlagStatus) status?: FeatureFlagStatus;
  @IsOptional() @IsString() category?: string;
  @IsOptional() conditions?: Record<string, any>;
  @IsOptional()
  @IsEnum(FeatureFlagRolloutStrategy)
  rolloutStrategy?: FeatureFlagRolloutStrategy;
  @IsOptional() @IsNumber() @Min(0) @Max(100) rolloutPercentage?: number;
  @IsOptional() targetingRules?: Array<any>;
  @IsOptional() allowedUserIds?: string[];
  @IsOptional() allowedRoleIds?: string[];
  @IsOptional() excludedUserIds?: string[];
  @IsOptional() variants?: Array<any>;
}

class UpdateFeatureFlagDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(FeatureFlagStatus) status?: FeatureFlagStatus;
  @IsOptional() @IsString() category?: string;
  @IsOptional() conditions?: Record<string, any>;
  @IsOptional()
  @IsEnum(FeatureFlagRolloutStrategy)
  rolloutStrategy?: FeatureFlagRolloutStrategy;
  @IsOptional() @IsNumber() @Min(0) @Max(100) rolloutPercentage?: number;
  @IsOptional() targetingRules?: Array<any>;
  @IsOptional() allowedUserIds?: string[];
  @IsOptional() allowedRoleIds?: string[];
  @IsOptional() excludedUserIds?: string[];
  @IsOptional() variants?: Array<any>;
}

@Controller('platform/feature-flags')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformFeatureFlagsController {
  constructor(
    private platformService: PlatformService,
    private flagEvaluationService: FeatureFlagEvaluationService,
  ) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('strategy') strategy?: string,
    @Query('scope') scope?: 'global' | 'hotel' | 'all',
  ) {
    return this.platformService.findAllFeatureFlags({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
      strategy,
      scope,
    });
  }

  @Get('rollout-summary')
  async getRolloutSummary() {
    return this.platformService.getRolloutSummary();
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

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  async evaluate(
    @Body() body: { flagName: string; context: EvaluationContext },
  ) {
    return {
      flagName: body.flagName,
      enabled: await this.flagEvaluationService.isEnabled(
        body.flagName,
        body.context,
      ),
    };
  }

  @Post('evaluate-variant')
  @HttpCode(HttpStatus.OK)
  async evaluateVariant(
    @Body() body: { flagName: string; context: EvaluationContext },
  ) {
    return this.flagEvaluationService.getVariant(body.flagName, body.context);
  }
}
