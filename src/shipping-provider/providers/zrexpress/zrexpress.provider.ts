import { randomUUID } from 'crypto';
import {
  LabelResult,
  ProviderMetadata,
  ShippingOrderInput,
  ShippingProviderContract,
  ShippingRate,
} from '../../interfaces/shipping-provider.interface';
import {
  CreateOrderException,
  CredentialsException,
  HttpShippingException,
  TrackingIdNotFoundException,
} from '../../exceptions/shipping-exception.filter';
import { productList, totalQuantity } from '../../integrations/order-helpers';
import { matchCommune, pickHub, wilayaRates, zrPhone, ZrHub, ZrRate, ZrTerritory } from './zr-rules';

// ZR Express — المنصة الجديدة (api.zrexpress.app): مفتاح سري (X-Api-Key) + معرّف المستأجر (X-Tenant)
const BASE = 'https://api.zrexpress.app/api/v1';
const CACHE_MS = 12 * 60 * 60 * 1000;

// الولايات/البلديات والمكاتب نفسها لكل الحسابات وتتغير نادراً ← ذاكرة مؤقتة 12 ساعة
let territoriesCache: { at: number; items: ZrTerritory[] } | null = null;
let hubsCache: { at: number; items: ZrHub[] } | null = null;

export class ZRExpressProvider implements ShippingProviderContract {
  private readonly secretKey: string;
  private readonly tenantId: string;

  constructor(credentials: Record<string, string>) {
    const secretKey = credentials.secretKey?.trim();
    const tenantId = credentials.tenantId?.trim();
    if (!secretKey || !tenantId) throw new CredentialsException(this.metadata().name, ['secretKey', 'tenantId']);
    this.secretKey = secretKey;
    this.tenantId = tenantId;
  }

  metadata(): ProviderMetadata {
    return {
      name: 'ZRExpress',
      title: 'ZR Express',
      logo: 'https://play-lh.googleusercontent.com/_JY-6AlfdbrqaZMEosTsMUCnezFQACvr5iGP19U814Hlw0vIhta7GZSBdQcb9JLHBn2MpHdWzCewLeWb6oJ15Q',
      description: 'ZR Express — société de livraison rapide et sécurisée en Algérie',
      website: 'https://zrexpress.app',
      api_docs: 'https://docs.zrexpress.app',
      support: 'https://www.facebook.com/ZRexpresslivraison/',
      tracking_url: null,
    };
  }

  private async call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<{ status: number; data: T }> {
    const res = await fetch(`${BASE}/${path}`, {
      method,
      headers: { 'X-Api-Key': this.secretKey, 'X-Tenant': this.tenantId, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  }

  /** رسالة الخطأ كما ترجعها ZR (ProblemDetails) دون أسرار */
  private static problem(data: any): string {
    if (!data || typeof data !== 'object') return String(data ?? '').slice(0, 300);
    const errors = data.errors && typeof data.errors === 'object'
      ? Object.entries(data.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' — ')
      : '';
    return [data.title ?? data.message, data.detail, errors].filter(Boolean).join(' — ').slice(0, 500);
  }

  private async searchAll<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    for (let page = 1; page <= 20; page++) {
      const { status, data } = await this.call<any>('POST', path, { pageNumber: page, pageSize: 1000 });
      if (status !== 200) throw new HttpShippingException(`ZRExpress: ${path} ${status} ${ZRExpressProvider.problem(data)}`, status);
      out.push(...(data?.items ?? []));
      if (!data?.hasNext) break;
    }
    return out;
  }

  private async territories(): Promise<ZrTerritory[]> {
    if (territoriesCache && Date.now() - territoriesCache.at < CACHE_MS) return territoriesCache.items;
    const items = await this.searchAll<ZrTerritory>('territories/search');
    territoriesCache = { at: Date.now(), items };
    return items;
  }

  private async hubs(): Promise<ZrHub[]> {
    if (hubsCache && Date.now() - hubsCache.at < CACHE_MS) return hubsCache.items;
    const items = await this.searchAll<ZrHub>('hubs/search');
    hubsCache = { at: Date.now(), items };
    return items;
  }

  async testCredentials(): Promise<boolean> {
    const { status } = await this.call('POST', 'hubs/search', { pageNumber: 1, pageSize: 1 });
    if (status === 200) return true;
    if (status === 401 || status === 403) return false;
    throw new HttpShippingException(`ZRExpress: unexpected status ${status}`, status);
  }

  async getRates(_fromWilayaId?: number, toWilayaId?: number): Promise<ShippingRate[]> {
    const { status, data } = await this.call<{ rates?: ZrRate[] }>('GET', 'delivery-pricing/rates');
    if (status !== 200) throw new HttpShippingException(`ZRExpress: failed to get rates (${status})`, status);
    const rows = wilayaRates(data?.rates ?? [], await this.territories());
    return toWilayaId ? rows.filter((r) => r.wilaya_id === Number(toWilayaId)) : rows;
  }

  getCreateOrderValidationRules(): Record<string, string> {
    return {
      customer: 'required',
      deliveryAddress: 'required',
      deliveryType: 'required|in:home,pickup-point',
      amount: 'required|numeric',
    };
  }

  /** إنشاء الطرد (جسم ZR كما هو) ثم قراءته للحصول على رقم التتبع — الإنشاء يرجع المعرّف فقط */
  async createOrder(orderData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const created = await this.call<{ id?: string }>('POST', 'parcels', orderData);
    if (created.status !== 200 && created.status !== 201) {
      throw new CreateOrderException(`ZR Express: ${ZRExpressProvider.problem(created.data) || created.status}`);
    }
    const id = created.data?.id;
    if (!id) throw new CreateOrderException(`ZR Express: réponse inattendue ${JSON.stringify(created.data).slice(0, 200)}`);
    const parcel = await this.call<Record<string, unknown>>('GET', `parcels/${id}`);
    const trackingNumber = parcel.status === 200 ? parcel.data?.trackingNumber : undefined;
    return { id, trackingNumber: trackingNumber ?? null, ...(parcel.status === 200 ? { parcel: parcel.data } : {}) };
  }

  async createOrderFromOrder(order: ShippingOrderInput): Promise<Record<string, unknown>> {
    const territories = await this.territories();
    const commune = matchCommune(territories, order.customerWilayaId, order.customerCommune);
    if (!commune) {
      throw new CreateOrderException(
        `ZR Express ne livre pas « ${order.customerCommune.name} » (wilaya ${order.customerWilayaId}) — commune introuvable chez ZR`,
      );
    }
    const wilayaId = commune.parentId as string;
    const office = order.typeShip !== 'home';
    let hubId: string | undefined;
    if (office) {
      const hub = pickHub(await this.hubs(), wilayaId, commune.id);
      if (!hub) throw new CreateOrderException(`ZR Express : aucun bureau (stop desk) dans la wilaya ${order.customerWilayaId}`);
      hubId = hub.id;
    }

    const amount = Number(order.totalPrice) || 0;
    const qty = totalQuantity(order);
    return this.createOrder({
      customer: {
        customerId: randomUUID(), // زبون بلا حساب عند ZR (مسموح في وثائقهم)
        name: String(order.customerName ?? '').trim().slice(0, 100),
        phone: { number1: zrPhone(order.customerPhone) },
      },
      deliveryAddress: {
        cityTerritoryId: wilayaId,
        districtTerritoryId: commune.id,
        street: `${commune.name}, ${order.customerWilaya.name}`,
      },
      ...(hubId ? { hubId } : {}),
      deliveryType: office ? 'pickup-point' : 'home',
      orderedProducts: [{ productName: productList(order), quantity: qty, unitPrice: Math.round((amount / qty) * 100) / 100, stockType: 'none' }],
      description: productList(order),
      amount,
      externalId: order.id,
    });
  }

  async getOrder(trackingId: string): Promise<Record<string, unknown>> {
    const { status, data } = await this.call<any>('GET', `parcels/${encodeURIComponent(trackingId)}`);
    if (status === 404) throw new TrackingIdNotFoundException(trackingId, this.metadata().name);
    if (status !== 200) throw new HttpShippingException(`ZRExpress: failed to read parcel (${status})`, status);
    // الحالة كنص (state.name مثل «livre»، «recupere_par_fournisseur») يقرؤها تحديث الطلبات
    return { ...data, status: data?.state?.name ?? null };
  }

  async orderLabel(trackingId: string): Promise<LabelResult> {
    const { status, data } = await this.call<any>('POST', 'parcels/labels/individual', { trackingNumbers: [trackingId] });
    const url = data?.parcelLabelFiles?.[0]?.fileUrl;
    if (status !== 200 || !url) throw new HttpShippingException(`ZRExpress: label unavailable for ${trackingId}`, status);
    return { type: 'url', data: url };
  }

  /** عدة طرود في ملف واحد (حتى 250) */
  async orderLabels(trackingIds: string[]): Promise<LabelResult & { failed: string[] }> {
    const { status, data } = await this.call<any>('POST', 'parcels/labels/multiple', { trackingNumbers: trackingIds });
    if (status !== 200 || !data?.fileUrl) throw new HttpShippingException(`ZRExpress: labels unavailable (${status})`, status);
    return { type: 'url', data: data.fileUrl, failed: data.failedTrackingNumbers ?? [] };
  }

  /** إلغاء الشحن: حذف الطرد (ZR تقبل قبل أن يستلمه الموزّع، وترفض بعده برسالتها) */
  async cancelOrder(trackingId: string): Promise<void> {
    const found = await this.call<any>('GET', `parcels/${encodeURIComponent(trackingId)}`);
    if (found.status === 404) throw new TrackingIdNotFoundException(trackingId, this.metadata().name);
    if (found.status !== 200 || !found.data?.id) throw new HttpShippingException(`ZRExpress: failed to read parcel (${found.status})`, found.status);
    const del = await this.call<any>('DELETE', `parcels/${found.data.id}`);
    if (del.status !== 200 && del.status !== 204) {
      throw new CreateOrderException(`ZR Express : ${ZRExpressProvider.problem(del.data) || `suppression refusée (${del.status})`}`);
    }
  }
}
