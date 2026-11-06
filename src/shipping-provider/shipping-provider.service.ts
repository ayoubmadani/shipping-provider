import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StoreShippingSettings } from './entities/store-shipping-settings.entity';
import { createProvider, getAllProvidersMetadata } from './providers/provider.registry';
import { ShippingOrderInput, ShippingProviderContract } from './interfaces/shipping-provider.interface';
import { SetShippingProviderDto, UpdateShippingProviderDto } from './dto/shipping.dto';

@Injectable()
export class ShippingProviderService {
  constructor(
    @InjectRepository(StoreShippingSettings)
    private readonly settingsRepo: Repository<StoreShippingSettings>,
  ) {}

  // ─── مزودي الخدمة المتاحين ───
  getAllProviders() {
    return getAllProvidersMetadata();
  }

  // «Tester» في اللوحة: تجربة المعرّفات بلا حفظ — أي خطأ يعني «غير صالحة»
  async testNewCredentials(dto: Pick<SetShippingProviderDto, 'providerName' | 'credentials'>): Promise<{ isVerified: boolean }> {
    try {
      return { isVerified: (await createProvider(dto.providerName, dto.credentials ?? {}).testCredentials()) === true };
    } catch {
      return { isVerified: false };
    }
  }

  // ─── إدارة الحسابات (مرتبطة بالمستخدم) ───

  async getStoreAccounts(userId: string): Promise<StoreShippingSettings[]> {
    return this.settingsRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async createAccount(
    userId: string,
    dto: SetShippingProviderDto,
  ): Promise<{ isVerified: boolean; id: string }> {
    const provider = createProvider(dto.providerName, dto.credentials);
    const isVerified = await provider.testCredentials();

    const account = this.settingsRepo.create({
      userId,
      accountName: dto.accountName || dto.providerName,
      providerName: dto.providerName,
      isVerified,
    });
    account.setCredentials(dto.credentials);

    const existingCount = await this.settingsRepo.count({ where: { userId } });
    account.isDefault = existingCount === 0;

    await this.settingsRepo.save(account);
    return { isVerified, id: account.id };
  }

  async updateAccount(
    userId: string,
    accountId: string,
    dto: UpdateShippingProviderDto,
  ): Promise<{ isVerified: boolean; id: string }> {
    const account = await this.settingsRepo.findOne({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException('الحساب غير موجود أو لا تملك صلاحية الوصول إليه');

    if (dto.accountName) account.accountName = dto.accountName;

    if (dto.credentials) {
      const provider = createProvider(account.providerName, dto.credentials);
      account.isVerified = await provider.testCredentials();
      account.setCredentials(dto.credentials);
    }

    await this.settingsRepo.save(account);
    return { isVerified: account.isVerified, id: account.id };
  }

  async setDefaultAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.settingsRepo.findOne({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundException('الحساب غير موجود أو لا تملك صلاحية الوصول إليه');

    await this.settingsRepo.update({ userId }, { isDefault: false });
    await this.settingsRepo.update({ id: accountId }, { isDefault: true });
  }

  async deleteAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.settingsRepo.findOne({
      where: { id: accountId, userId },
    });
    if (!account) throw new NotFoundException('الحساب غير موجود');

    const wasDefault = account.isDefault;
    await this.settingsRepo.remove(account);

    if (wasDefault) {
      const next = await this.settingsRepo.findOne({
        where: { userId },
        order: { createdAt: 'ASC' },
      });
      if (next) await this.settingsRepo.update(next.id, { isDefault: true });
    }
  }

  // ─── جلب المزود للعمليات ───

  // accountId: حساب محدد (يجب أن يملكه نفس المستخدم) — بدونه الحساب الافتراضي للمتجر
  private async getProviderForUser(storeId: string, userId: string, accountId?: string): Promise<ShippingProviderContract> {
    if (accountId) {
      const chosen = await this.settingsRepo.findOne({ where: { id: accountId, userId } });
      if (!chosen) throw new NotFoundException('حساب التوصيل المحدد غير موجود.');
      return createProvider(chosen.providerName, chosen.getParsedCredentials());
    }
    // الحسابات تُحفظ للمستخدم بلا storeId (createAccount) — البحث بـ storeId وحده لا يجد شيئاً.
    // نفضّل حساب هذا المتجر إن وُجد، ثم الحساب الافتراضي للمستخدم، ثم أي حساب له
    const account =
      (await this.settingsRepo.findOne({ where: { storeId, userId, isDefault: true } })) ??
      (await this.settingsRepo.findOne({ where: { storeId, userId } })) ??
      (await this.settingsRepo.findOne({ where: { userId, isDefault: true } })) ??
      (await this.settingsRepo.findOne({ where: { userId }, order: { createdAt: 'ASC' } }));

    if (!account) {
      throw new NotFoundException('لم يتم إعداد مزود شحن لهذا المستخدم في هذا المتجر.');
    }

    return createProvider(account.providerName, account.getParsedCredentials());
  }

  // ─── عمليات الشحن ───

  async testCredentials(storeId: string, userId: string): Promise<boolean> {
    const provider = await this.getProviderForUser(storeId, userId);
    return provider.testCredentials();
  }

  async getRates(storeId: string, userId: string, fromWilayaId?: number, toWilayaId?: number) {
    const provider = await this.getProviderForUser(storeId, userId);
    return provider.getRates(fromWilayaId, toWilayaId);
  }

  async getValidationRules(storeId: string, userId: string) {
    const provider = await this.getProviderForUser(storeId, userId);
    return provider.getCreateOrderValidationRules();
  }

  async createOrder(storeId: string, userId: string, order: ShippingOrderInput, accountId?: string) {
    const provider = await this.getProviderForUser(storeId, userId, accountId);
    return provider.createOrderFromOrder(order);
  }

  async getOrder(storeId: string, userId: string, trackingId: string, accountId?: string) {
    const provider = await this.getProviderForUser(storeId, userId, accountId);
    return provider.getOrder(trackingId);
  }

  async getOrderLabel(storeId: string, userId: string, orderId: string, accountId?: string) {
    const provider = await this.getProviderForUser(storeId, userId, accountId);
    return provider.orderLabel(orderId);
  }
}
