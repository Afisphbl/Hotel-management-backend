import { IsOptional, IsString, IsNumber, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoomTypeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  baseCapacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxExtraBeds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basePrice?: number;

  @IsOptional()
  @IsString()
  image?: string;
}

export class UpdateRoomTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  baseCapacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxExtraBeds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basePrice?: number;

  @IsOptional()
  @IsString()
  image?: string;
}
