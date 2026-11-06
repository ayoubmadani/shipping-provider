import test from 'node:test';
import assert from 'node:assert/strict';
import { ZRExpressProvider } from './providers/zrexpress/zrexpress.provider';
import { ShippingExceptionFilter } from './exceptions/shipping-exception.filter';
import { CreateOrderException, FunctionNotSupportedException, TrackingIdNotFoundException } from './exceptions/shipping-exception.filter';

const zr = () => new ZRExpressProvider({ secretKey: 'k', tenantId: 't' });
const withFetch = async (routes: Record<string, { status: number; body?: unknown }>, fn: (calls: string[]) => Promise<void>) => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string, init?: any) => {
    const key = `${init?.method ?? 'GET'} ${String(url).replace('https://api.zrexpress.app/api/v1/', '')}`;
    calls.push(key);
    const r = routes[key] ?? { status: 404 };
    return { status: r.status, text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) } as any;
  }) as any;
  try { await fn(calls); } finally { globalThis.fetch = original; }
};

test('ZR cancel: finds the parcel by tracking, deletes it by id', async () => {
  await withFetch({ 'GET parcels/16-AB-ZR': { status: 200, body: { id: 'p1' } }, 'DELETE parcels/p1': { status: 200 } }, async (calls) => {
    await zr().cancelOrder('16-AB-ZR');
    assert.deepEqual(calls, ['GET parcels/16-AB-ZR', 'DELETE parcels/p1']);
  });
});

test('ZR cancel: refused (already picked up) → error carrying ZR reason; unknown tracking → not found', async () => {
  await withFetch({ 'GET parcels/16-AB-ZR': { status: 200, body: { id: 'p1' } }, 'DELETE parcels/p1': { status: 400, body: { title: 'Parcel cannot be deleted in its current state' } } }, async () => {
    await assert.rejects(zr().cancelOrder('16-AB-ZR'), (e: any) => e instanceof CreateOrderException && /current state/.test(e.message));
  });
  await withFetch({}, async () => {
    await assert.rejects(zr().cancelOrder('nope'), TrackingIdNotFoundException);
  });
});

test('errors reach the API with their message (not a bare 500)', () => {
  const sent: any[] = [];
  const host: any = { switchToHttp: () => ({ getResponse: () => ({ status: (s: number) => ({ json: (b: any) => sent.push([s, b]) }) }) }) };
  const filter = new ShippingExceptionFilter();
  filter.catch(new CreateOrderException('ZR Express ne livre pas « X »'), host);
  filter.catch(new TrackingIdNotFoundException('T1', 'ZRExpress'), host);
  filter.catch(new FunctionNotSupportedException('cancelOrder', 'Yalidine'), host);
  assert.deepEqual(sent.map(([s]) => s), [400, 404, 400]);
  assert.match(sent[0][1].message, /ne livre pas/);
});
