import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SetShippingProviderDto, UpdateShippingProviderDto, CreateShippingOrderDto } from './dto/shipping.dto';
import { ShippingProviderService } from './shipping-provider.service';
import { InternalAuthGuard } from './guards/internal-auth.guard';
import { InternalUserId } from './decorators/internal-user-id.decorator';

@Controller('stores/:storeId/shipping')
@UseGuards(InternalAuthGuard)
export class ShippingProviderController {
  constructor(private readonly shippingService: ShippingProviderService) {}

  // ─── مزودي الخدمة (العامة) ───
  @Get('providers')
  getAllProviders() {
    return this.shippingService.getAllProviders();
  }

  // ─── إدارة حسابات المستخدم ───

  @Get('accounts')
  getAccounts(@Param('storeId') storeId: string, @InternalUserId() userId: string) {
    return this.shippingService.getStoreAccounts(userId);
  }

  @Post('accounts')
  createAccount(
    @Param('storeId') storeId: string,
    @Body() dto: SetShippingProviderDto,
    @InternalUserId() userId: string,
  ) {
    return this.shippingService.createAccount(userId, dto);
  }

  @Patch('accounts/:accountId')
  updateAccount(
    @Param('storeId') storeId: string,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateShippingProviderDto,
    @InternalUserId() userId: string,
  ) {
    return this.shippingService.updateAccount(userId, accountId, dto);
  }

  @Patch('accounts/:accountId/default')
  setDefaultAccount(
    @Param('storeId') storeId: string,
    @Param('accountId') accountId: string,
    @InternalUserId() userId: string,
  ) {
    return this.shippingService.setDefaultAccount(userId, accountId);
  }

  @Delete('accounts/:accountId')
  deleteAccount(
    @Param('storeId') storeId: string,
    @Param('accountId') accountId: string,
    @InternalUserId() userId: string,
  ) {
    return this.shippingService.deleteAccount(userId, accountId);
  }

  // ─── عمليات الشحن ───

  @Get('test-credentials')
  testCredentials(@Param('storeId') storeId: string, @InternalUserId() userId: string) {
    return this.shippingService.testCredentials(storeId, userId);
  }

  @Get('rates')
  getRates(
    @Param('storeId') storeId: string,
    @InternalUserId() userId: string,
    @Query('fromWilayaId') fromWilayaId?: string,
    @Query('toWilayaId') toWilayaId?: string,
  ) {
    return this.shippingService.getRates(
      storeId,
      userId,
      fromWilayaId ? +fromWilayaId : undefined,
      toWilayaId ? +toWilayaId : undefined,
    );
  }

  @Get('validation-rules')
  getValidationRules(@Param('storeId') storeId: string, @InternalUserId() userId: string) {
    return this.shippingService.getValidationRules(storeId, userId);
  }

  @Post('orders')
  createOrder(
    @Param('storeId') storeId: string,
    @Body() dto: CreateShippingOrderDto,
    @InternalUserId() userId: string,
  ) {
    return this.shippingService.createOrder(storeId, userId, dto.order);
  }

  @Get('orders/:trackingId')
  getOrder(
    @Param('storeId') storeId: string,
    @Param('trackingId') trackingId: string,
    @InternalUserId() userId: string,
  ) {
    return this.shippingService.getOrder(storeId, userId, trackingId);
  }

  @Get('orders/:orderId/label')
  getLabel(
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
    @InternalUserId() userId: string,
  ) {
    return this.shippingService.getOrderLabel(storeId, userId, orderId);
  }
}
