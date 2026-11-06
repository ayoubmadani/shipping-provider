import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { ShippingOrderInput } from '../interfaces/shipping-provider.interface';

export class SetShippingProviderDto {
  @IsString()
  @IsNotEmpty()
  providerName: string;

  @IsString()
  @IsOptional()
  accountName: string;

  @IsObject()
  credentials: Record<string, string>;
}

export class UpdateShippingProviderDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsObject()
  @IsOptional()
  credentials?: Record<string, string>;
}

export class CreateShippingOrderDto {
  @IsObject()
  order: ShippingOrderInput;

  // حساب توصيل محدد من حسابات التاجر — بدونه الحساب الافتراضي
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class GetRatesDto {
  fromWilayaId?: number;
  toWilayaId?: number;
}

export class LabelsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(250)
  @IsString({ each: true })
  trackingIds: string[];

  @IsOptional()
  @IsUUID()
  accountId?: string;
}
