import { ShippingOrderInput } from '../interfaces/shipping-provider.interface';

/** هاتف جزائري بالصيغة الوطنية 0XXXXXXXXX (يحذف +213 / 00213 / المسافات والشرطات). يُعاد كما هو إن لم يكن رقماً */
export function nationalPhone(phone: string | null | undefined): string {
  const raw = String(phone ?? '').trim();
  let digits = raw.replace(/\D+/g, '');
  if (!digits) return raw;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('213')) digits = digits.slice(3);
  const core = digits.replace(/^0+/, '');
  return core ? `0${core}` : raw;
}

/** أسماء المنتجات وكمياتها لوصف الطرد («حذاء ×2 + قميص») — بدل «Article1» */
export function productList(order: Pick<ShippingOrderInput, 'items'>, max = 255): string {
  const parts = (order.items ?? [])
    .map((i) => {
      const name = String(i.product?.name ?? '').trim();
      if (!name) return '';
      return Number(i.quantity) > 1 ? `${name} ×${i.quantity}` : name;
    })
    .filter(Boolean);
  const text = parts.join(' + ') || 'Produit';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** مجموع القطع في الطلب (أقلها 1) */
export const totalQuantity = (order: Pick<ShippingOrderInput, 'items'>) =>
  Math.max(1, (order.items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0), 0));
