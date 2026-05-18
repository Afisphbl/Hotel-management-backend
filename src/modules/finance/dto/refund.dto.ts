import { IsUUID, IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { RefundReason, RefundStatus } from '../../../database/entities/refund.entity';
import { PaginationDto } from './pagination.dto';

export class CreateRefundDto {
  @IsUUID()
  paymentId: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsEnum(RefundReason)
  reason: RefundReason;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryRefundDto extends PaginationDto {
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsEnum(RefundReason)
  reason?: RefundReason;
}
