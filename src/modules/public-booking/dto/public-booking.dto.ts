import {
  IsEmail,
  IsString,
  IsDateString,
  IsUUID,
  IsOptional,
  MinLength,
  IsInt,
  Min,
} from 'class-validator';

export class GuestRegisterDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() nationality?: string;
}

export class GuestLoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

export class CreatePublicBookingDto {
  @IsUUID()
  roomId: string;

  @IsDateString()
  checkIn: string;

  @IsDateString()
  checkOut: string;

  @IsInt()
  @Min(1)
  numGuests: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class ChapaWebhookDto {
  @IsString() tx_ref: string;
  @IsString() status: string;
}
