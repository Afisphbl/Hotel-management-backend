import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BankAccountDto {
  @IsString() bankName: string;
  @IsString() accountName: string;
  @IsString() accountNumber: string;
  @IsOptional() @IsString() branchName?: string;
  @IsOptional() @IsString() swiftCode?: string;
}

export class GatewayConfigDto {
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsString() publicKey?: string;
  @IsOptional() @IsString() secretKey?: string;
  @IsOptional() @IsString() webhookSecret?: string;
  @IsOptional() @IsObject() additionalSettings?: any;
}

export class InvoiceSettingsDto {
  @IsString() prefix: string;
  @IsString() nextNumber: string;
  @IsOptional() @IsString() footerText?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsBoolean() showTaxBreakdown: boolean;
}

export class UpdateHotelFinanceConfigDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankAccountDto)
  bankAccounts?: BankAccountDto[];

  @IsOptional()
  @IsObject()
  gateways?: {
    chapa?: GatewayConfigDto;
    stripe?: GatewayConfigDto;
    paypal?: GatewayConfigDto;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedPaymentMethods?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceSettingsDto)
  invoiceSettings?: InvoiceSettingsDto;
}
