import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreShippingSettings } from './entities/store-shipping-settings.entity';
import { ShippingProviderController } from './shipping-provider.controller';
import { ShippingProviderService } from './shipping-provider.service';
import { InternalAuthGuard } from './guards/internal-auth.guard';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([StoreShippingSettings])],
  controllers: [ShippingProviderController],
  providers: [ShippingProviderService, InternalAuthGuard],
})
export class ShippingProviderModule {}
