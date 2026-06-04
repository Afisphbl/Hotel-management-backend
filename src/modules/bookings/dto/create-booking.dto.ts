import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
  ArrayMinSize,
  IsEnum,
} from 'class-validator';
import { BookingStatus } from '../../../database/entities/booking.entity';

export class CreateBookingDto {
  @IsUUID()
  guestId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roomIds: string[];

  @IsDateString()
  @IsNotEmpty()
  checkIn: string;

  @IsDateString()
  @IsNotEmpty()
  checkOut: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ConfirmBookingDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roomIds?: string[];
}

export class CalculatePricePreviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roomIds: string[];

  @IsDateString()
  @IsNotEmpty()
  checkIn: string;

  @IsDateString()
  @IsNotEmpty()
  checkOut: string;
}

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  @IsNotEmpty()
  status: BookingStatus;
}

export class QueryBookingsDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  guestId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
