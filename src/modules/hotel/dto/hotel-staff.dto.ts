import {
  IsOptional,
  IsString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import {
  StaffRole,
  StaffStatus,
} from '../../../database/entities/staff.entity';
import { Type } from 'class-transformer';

export class CreateHotelStaffDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(StaffRole)
  role: StaffRole;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  joinedAt?: string;
}

export class UpdateHotelStaffDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsEnum(StaffStatus)
  status?: StaffStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  joinedAt?: string;
}
