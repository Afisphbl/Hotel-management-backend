import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min, IsDateString } from 'class-validator';
import { TaxType, TaxApplication } from '../../../database/entities/tax-rule.entity';
import { PaginationDto } from './pagination.dto';

export class CreateTaxRuleDto {
  @IsString()
  name: string;

  @IsEnum(TaxType)
  type: TaxType;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsOptional()
  @IsEnum(TaxApplication)
  application?: TaxApplication;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTaxRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(TaxType)
  type?: TaxType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsEnum(TaxApplication)
  application?: TaxApplication;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class QueryTaxRuleDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TaxType)
  type?: TaxType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
