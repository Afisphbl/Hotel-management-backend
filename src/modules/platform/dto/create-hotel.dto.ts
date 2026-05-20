import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Min,
  IsNumber,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { SubscriptionPlan } from '../../../database/entities/global/subscriptions.entity';

export class CreateHotelDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(255)
  ownerEmail: string;

  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(63)
  subdomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan | string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rooms?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayNotEmpty()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  accentColor?: string;
}
