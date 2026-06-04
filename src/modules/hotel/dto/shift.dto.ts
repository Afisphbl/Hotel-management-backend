import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ShiftStatus } from '../../../database/entities/shift.entity';

export class CreateShiftDto {
  @IsString()
  staffId: string;

  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @IsDateString()
  startTime: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsEnum(ShiftStatus)
  status?: ShiftStatus;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
