import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
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
}

export class GetRatesDto {
  fromWilayaId?: number;
  toWilayaId?: number;
}
