import {
  IsOptional,
  IsInt,
  IsString,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sortBy?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sortOrder?: 'ASC' | 'DESC';
}
