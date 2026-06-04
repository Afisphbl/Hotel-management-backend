import { IsOptional, IsString, IsEmail, IsBoolean } from 'class-validator';

export class CreateGuestDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

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

export class UpdateGuestDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  nationalID?: string;

  @IsOptional()
  @IsString()
  countryFlag?: string;
}
