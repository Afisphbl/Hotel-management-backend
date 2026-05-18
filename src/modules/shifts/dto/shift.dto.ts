import { IsOptional, IsString, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { ShiftStatus } from '../../../database/entities/shift.entity';
import { PaginationDto } from './pagination.dto';

export class CreateShiftDto {
  @IsUUID()
  staffId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryShiftDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
