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
  metadata(): ProviderMetadata;
}
