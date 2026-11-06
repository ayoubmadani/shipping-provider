export interface ProviderMetadata {
  name: string;
  title: string;
  logo: string | null;
  description: string;
  website: string;
  api_docs: string | null;
  support: string | null;
  tracking_url: string | null;
}

export interface LabelResult {
  type: 'pdf' | 'url';
  data: string;
}

export interface ShippingRate {
  wilaya_id?: number;
  [key: string]: unknown;
}

// Plain, transport-shaped stand-in for the api project's Order entity.
// Built by the api project (which owns the Order/Product/Wilaya/Commune graph)
// and sent as-is in the create-order request — shipping-provider never
// queries orders itself.
export interface ShippingOrderInput {
  id: string;
  typeShip: string;
  customerName: string;
  customerPhone: string;
  customerWilayaId: number;
  customerCommuneId: number;
  customerWilaya: { name: string; ar_name: string };
  /** الولاية الحقيقية برقمها الرسمي (1..69) لمتجر بتقسيم 69 ولاية — للشركات التي تدعمها (ZR). غيرها يستعمل customerWilayaId (الأم من الـ58) */
  customerWilaya69?: { id: number; name: string; ar_name: string } | null;
  customerCommune: { name: string; ar_name: string };
  totalPrice: number | string;
  items: { quantity: number; product?: { name: string } }[];
  /** ولاية المتجر (اسمها بالفرنسية، من إعدادات المتجر) — ولاية الإرسال لياليدين؛ بدونها «Alger» */
  fromWilayaName?: string | null;
}

export interface ShippingProviderContract {
  testCredentials(): Promise<boolean>;
  getRates(fromWilayaId?: number, toWilayaId?: number): Promise<ShippingRate[]>;
  getCreateOrderValidationRules(): Record<string, string>;
  createOrder(orderData: Record<string, unknown>): Promise<Record<string, unknown>>;
  createOrderFromOrder(order: ShippingOrderInput): Promise<Record<string, unknown>>;
  getOrder(trackingId: string): Promise<Record<string, unknown>>;
  orderLabel(orderId: string): Promise<LabelResult>;
  /** طباعة جماعية في ملف واحد (إن كانت الشركة تدعمها) — failed: أرقام لم يُصنع ملصقها */
  orderLabels?(trackingIds: string[]): Promise<LabelResult & { failed?: string[] }>;
  /** إلغاء الشحن (حذف الطرد عند الشركة) — غير موجود = الشركة لا تسمح به عبر الـ API */
  cancelOrder?(trackingId: string): Promise<void>;
  metadata(): ProviderMetadata;
}
