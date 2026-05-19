import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

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
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
