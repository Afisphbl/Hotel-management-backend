import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator';

export class GuestRegisterDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsUUID()
  hotelId: string;
}

export class GuestLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsUUID()
  hotelId: string;
}
