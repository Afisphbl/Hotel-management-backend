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
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../database/entities/global/subscriptions.entity';
import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

class CreateSubscriptionDto {
  @IsUUID() hotelId: string;
  @IsEnum(SubscriptionPlan) plan: SubscriptionPlan;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsDateString() trialEndDate?: string;
  @IsOptional() features?: Record<string, any>;
}

class UpdateSubscriptionDto {
  @IsOptional() @IsEnum(SubscriptionPlan) plan?: SubscriptionPlan;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsDateString() trialEndDate?: string;
  @IsOptional() features?: Record<string, any>;
}

@Controller('platform/subscriptions')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformSubscriptionsController {
  constructor(private platformService: PlatformService) {}

  @Get()
  async findAll() {
    return this.platformService.findAllSubscriptions();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.platformService.findSubscriptionById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSubscriptionDto) {
    return this.platformService.createSubscription(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.platformService.updateSubscription(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.platformService.deleteSubscription(id);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    return this.platformService.cancelSubscription(id);
  }
}
