import { IsString, IsOptional } from 'class-validator';

export class Activate2faDto {
  @IsString()
  secret: string;

  @IsString()
  code: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  newPassword: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
