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
import { LedgerService } from '../services/ledger.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { CreateLedgerEntryDto, QueryLedgerDto } from '../dto/ledger.dto';
import { success, paginated } from '../common/response';

@Controller('finance/ledger')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class LedgerController {
  constructor(private ledgerService: LedgerService) {}

  @Get()
  async findAll(@Query() query: QueryLedgerDto) {
    const result = await this.ledgerService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get('trial-balance')
  async trialBalance() {
    const balances = await this.ledgerService.getTrialBalance();
    return success(balances);
  }

  @Get('balance/:accountId')
  async accountBalance(@Param('accountId') accountId: string) {
    const balance = await this.ledgerService.getAccountBalance(accountId);
    return success({ accountId, balance });
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const entry = await this.ledgerService.findById(id);
    return success(entry);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateLedgerEntryDto) {
    const entry = await this.ledgerService.create(dto);
    return success(entry);
  }
}
