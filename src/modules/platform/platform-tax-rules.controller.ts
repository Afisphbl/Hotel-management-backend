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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { TaxRuleService } from './tax-rule.service';
import {
  PlatformTaxType,
  TaxRuleStatus,
} from '../../database/entities/global/platform-tax-rule.entity';

@Controller('platform/tax-rules')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformTaxRulesController {
  constructor(private readonly taxRuleService: TaxRuleService) {}

  @Get()
  async findAll(
    @Query('country') country?: string,
    @Query('status') status?: TaxRuleStatus,
    @Query('type') type?: PlatformTaxType,
  ) {
    return this.taxRuleService.findAll({ country, status, type });
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.taxRuleService.findById(id);
  }

  @Post()
  async create(@Body() data: any) {
    return this.taxRuleService.create(data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.taxRuleService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.taxRuleService.delete(id);
    return { success: true };
  }

  @Get('applicable/:country')
  async getApplicable(
    @Param('country') country: string,
    @Query('region') region?: string,
  ) {
    return this.taxRuleService.getApplicableTaxes(country, region);
  }
}
