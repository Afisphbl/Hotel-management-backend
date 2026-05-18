import { IsUUID, IsNumber, IsString, IsOptional, IsEnum, Min, IsDateString } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '../../../database/entities/payment.entity';
import { PaginationDto } from './pagination.dto';

export class CreatePaymentDto {
  @IsUUID()
  invoiceId: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  gatewayResponse?: any;

  @IsString()
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class QueryPaymentDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
