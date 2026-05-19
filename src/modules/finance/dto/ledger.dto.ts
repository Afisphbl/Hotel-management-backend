import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  Min,
  IsDateString,
} from 'class-validator';
import { PaginationDto } from './pagination.dto';

export enum LedgerAccountType {
  REVENUE = 'REVENUE',
  CASH = 'CASH',
  ACCOUNTS_RECEIVABLE = 'ACCOUNTS_RECEIVABLE',
  DEFERRED_REVENUE = 'DEFERRED_REVENUE',
  TAX_PAYABLE = 'TAX_PAYABLE',
  FEES_EXPENSE = 'FEES_EXPENSE',
}

export class CreateLedgerEntryDto {
  @IsString()
  accountId: string;

  @IsNumber()
  @Min(0)
  debit: number;

  @IsNumber()
  @Min(0)
  credit: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  referenceType: string;

  @IsString()
  referenceId: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class QueryLedgerDto extends PaginationDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
