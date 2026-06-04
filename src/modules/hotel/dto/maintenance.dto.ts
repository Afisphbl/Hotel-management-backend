import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import {
  TicketPriority,
  TicketStatus,
} from '../../../database/entities/maintenance-ticket.entity';
import { Type } from 'class-transformer';

export class CreateMaintenanceDto {
  @IsString()
  roomId: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMaintenanceDto {
  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
