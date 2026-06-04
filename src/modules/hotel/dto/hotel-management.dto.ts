import { IsOptional, IsString, IsInt, IsEnum, Min } from 'class-validator';
import { HotelType } from '../../../database/entities/hotel.entity';
import { Type } from 'class-transformer';

export class CreateHotelDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(HotelType)
  type?: HotelType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  rooms?: number;
}

export class UpdateHotelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(HotelType)
  type?: HotelType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  rooms?: number;
}
