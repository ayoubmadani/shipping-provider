import test from 'node:test';
import assert from 'node:assert/strict';
import { ShippingProviderService } from './shipping-provider.service';
import { PROVIDER_REGISTRY } from './providers/provider.registry';

// «Tester» في اللوحة: يجرّب المعرّفات بلا حفظ — أي خطأ (شركة غير معروفة، خانة ناقصة، شبكة) = غير صالحة
const service = new ShippingProviderService({} as any);

test('testCredentials: valid → true, nothing saved', async () => {
  const original = PROVIDER_REGISTRY.ZRExpress;
  PROVIDER_REGISTRY.ZRExpress = class { testCredentials = async () => true } as any;
  try {
    assert.deepEqual(await service.testNewCredentials({ providerName: 'ZRExpress', credentials: { secretKey: 'k', tenantId: 't' } } as any), { isVerified: true });
  } finally { PROVIDER_REGISTRY.ZRExpress = original; }
});

test('testCredentials: missing field, unknown company or network error → false', async () => {
  assert.deepEqual(await service.testNewCredentials({ providerName: 'ZRExpress', credentials: { secretKey: 'k' } } as any), { isVerified: false });
  assert.deepEqual(await service.testNewCredentials({ providerName: 'Nope', credentials: {} } as any), { isVerified: false });
  const original = PROVIDER_REGISTRY.ZRExpress;
  PROVIDER_REGISTRY.ZRExpress = class { testCredentials = async () => { throw new Error('ECONNRESET'); } } as any;
  try {
    assert.deepEqual(await service.testNewCredentials({ providerName: 'ZRExpress', credentials: { secretKey: 'k', tenantId: 't' } } as any), { isVerified: false });
  } finally { PROVIDER_REGISTRY.ZRExpress = original; }
});
