import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateGuestProfileDto {
  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  nationalID?: string;

  @IsOptional()
  @IsString()
  countryFlag?: string;
}

export class CalculatePriceDto {
  @IsString()
  hotelId: string;

  @IsString()
  roomId: string;

  @IsString()
  checkIn: string;

  @IsString()
  checkOut: string;
}

export class CreateReviewDto {
  @IsString()
  hotelId: string;

  @IsString()
  roomId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  rating: number;

  @IsString()
  comment: string;
}
