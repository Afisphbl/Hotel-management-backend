import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsUUID,
  Min,
} from 'class-validator';
import { RoomStatus } from '../../../database/entities/room.entity';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @IsString()
  roomNumber: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  baseCapacity?: number;

  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @IsOptional()
  @IsArray()
  images?: string[];
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsUUID()
  roomTypeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  basePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  baseCapacity?: number;

  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @IsOptional()
  @IsArray()
  images?: string[];
}
