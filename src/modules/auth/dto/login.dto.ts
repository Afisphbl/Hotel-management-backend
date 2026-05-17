import { IsEmail, IsString, IsOptional, IsUUID } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsUUID()
  hotelId?: string;
}
