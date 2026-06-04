import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { DiscountType } from '../../../database/entities/promotion.entity';
import { Type } from 'class-transformer';

export class CreateOverrideDto {
  @IsString()
  roomTypeId: string;

  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateOverrideDto {
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreatePromotionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountValue: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountValue?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSeasonalRateDto {
  @IsString()
  name: string;

  @IsString()
  roomTypeId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fixedPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  multiplier?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSeasonalRateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fixedPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  multiplier?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateRatePlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  roomTypeId: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weekdayAdjustment?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weekendAdjustment?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weekdayAdjustment?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  weekendAdjustment?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
