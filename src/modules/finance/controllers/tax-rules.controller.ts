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
import { TaxRulesService } from '../services/tax-rules.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import {
  CreateTaxRuleDto,
  UpdateTaxRuleDto,
  QueryTaxRuleDto,
} from '../dto/tax-rule.dto';
import { success, paginated } from '../common/response';

@Controller('finance/tax-rules')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class TaxRulesController {
  constructor(private taxRulesService: TaxRulesService) {}

  @Get()
  async findAll(@Query() query: QueryTaxRuleDto) {
    const result = await this.taxRulesService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const rule = await this.taxRulesService.findById(id);
    return success(rule);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTaxRuleDto) {
    const rule = await this.taxRulesService.create(dto);
    return success(rule);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTaxRuleDto) {
    const rule = await this.taxRulesService.update(id, dto);
    return success(rule);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.taxRulesService.remove(id);
  }
}
