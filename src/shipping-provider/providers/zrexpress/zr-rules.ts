import { nationalPhone } from '../../integrations/order-helpers';

// قواعد ZR Express (المنصة الجديدة api.zrexpress.app) بلا شبكة: البلدية ← territory، الهاتف، الأسعار، المكتب

export type ZrTerritory = {
  id: string;
  code: number;
  name: string;
  nameArabic?: string | null;
  level: string; // 'wilaya' | 'commune'
  parentId: string | null;
};

export type ZrHub = {
  id: string;
  isPickupPoint: boolean;
  isVisible: boolean;
  address: { cityTerritoryId?: string | null; districtTerritoryId?: string | null };
};

type ZrPrice = { deliveryType: string; price: number | null; discountedPrice?: number | null };
export type ZrRate = { toTerritoryId?: string; toTerritoryCode?: number; toTerritoryName?: string; toTerritoryLevel?: string; deliveryPrices?: ZrPrice[] };

const norm = (s: string | null | undefined) =>
  String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ـ/g, '')
    .replace(/[^a-z0-9؀-ۿ]+/g, '');

// للمقارنة التقريبية: بلا «El / Al / L'» ولا «La / Le»
const loose = (s: string | null | undefined) =>
  norm(String(s ?? '').replace(/\b(el|al|l|la|le)\b['’\s-]*/gi, ' '));

/** نسبة التشابه 0..1 (Levenshtein) */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

const MIN_SIMILARITY = 0.8;

/**
 * بلديتنا ← بلدية ZR داخل نفس الولاية (رقمها من الـ58).
 * الاسم العربي أولاً: في قاعدتنا أسماء فرنسية مكررة داخل الولاية (سطر «Dely Ibrahim» عربيّه «الدرارية»)
 * والعربي هو الذي يميّزها. ثم الفرنسي، ثم أقرب كتابة فرنسية.
 * الرمز البريدي غير موثوق (الترقيم يختلف بين الطرفين) فلا يُستعمل.
 */
export function matchCommune(territories: ZrTerritory[], wilayaCode: number, commune: { name: string; ar_name: string }): ZrTerritory | null {
  const wilaya = territories.find((t) => t.level === 'wilaya' && Number(t.code) === Number(wilayaCode));
  if (!wilaya) return null;
  const list = territories.filter((t) => t.level === 'commune' && t.parentId === wilaya.id);

  const ar = norm(commune.ar_name);
  const byAr = ar ? list.filter((t) => norm(t.nameArabic) === ar) : [];
  if (byAr.length === 1) return byAr[0];

  const fr = norm(commune.name);
  const byFr = list.filter((t) => norm(t.name) === fr);
  if (byFr.length === 1) return byFr[0];

  let best: ZrTerritory | null = null;
  let score = 0;
  for (const t of list) {
    const s = similarity(loose(t.name), loose(commune.name));
    if (s > score) { score = s; best = t; }
  }
  return score >= MIN_SIMILARITY ? best : null;
}

/** الهاتف بالصيغة الدولية التي تشترطها ZR: +213XXXXXXXXX */
export function zrPhone(phone: string | null | undefined): string {
  const national = nationalPhone(phone);
  return /^0\d+$/.test(national) ? `+213${national.slice(1)}` : national;
}

const price = (prices: ZrPrice[] | undefined, type: string) => {
  const p = (prices ?? []).find((x) => x.deliveryType === type);
  const v = p?.discountedPrice ?? p?.price;
  return v == null ? null : Number(v);
};

/** الأكثر تكراراً (null إن لم يوجد) */
function mode(values: (number | null)[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let n = 0;
  for (const [v, c] of counts) if (c > n || (c === n && best != null && v < best)) { best = v; n = c; }
  return best;
}

/**
 * أسعار ZR ← سطر لكل ولاية بالصيغة التي تقرؤها لوحة التحكم (home / stopdesk).
 * ولاية بلا سعر عام (الجزائر العاصمة: سعر لكل بلدية) تأخذ السعر الأكثر تكراراً بين بلدياتها.
 */
export function wilayaRates(rates: ZrRate[], territories: ZrTerritory[] = []) {
  const row = (code: number, name: string, prices: (type: string) => number | null) =>
    ({ wilaya_id: code, wilaya_name: name, home: prices('home'), stopdesk: prices('pickup-point'), return: prices('return') });

  const out = rates
    .filter((r) => r.toTerritoryLevel === 'wilaya' && Number(r.toTerritoryCode) > 0)
    .map((r) => row(Number(r.toTerritoryCode), r.toTerritoryName ?? '', (t) => price(r.deliveryPrices, t)));

  const byId = new Map(territories.map((t) => [t.id, t]));
  const perWilaya = new Map<string, ZrRate[]>();
  for (const r of rates) {
    if (r.toTerritoryLevel !== 'commune') continue;
    const parent = byId.get(String(r.toTerritoryId))?.parentId;
    if (parent) perWilaya.set(parent, [...(perWilaya.get(parent) ?? []), r]);
  }
  for (const [wid, list] of perWilaya) {
    const w = byId.get(wid);
    if (!w || out.some((o) => o.wilaya_id === Number(w.code))) continue;
    out.push(row(Number(w.code), w.name, (t) => mode(list.map((r) => price(r.deliveryPrices, t)))));
  }
  return out.sort((a, b) => a.wilaya_id - b.wilaya_id);
}

/** مكتب الاستلام (stop desk): في البلدية نفسها إن وُجد، وإلا أي مكتب ظاهر في الولاية */
export function pickHub(hubs: ZrHub[], wilayaTerritoryId: string, communeTerritoryId: string): ZrHub | null {
  const open = hubs.filter((h) => h.isPickupPoint && h.isVisible);
  return open.find((h) => h.address?.districtTerritoryId === communeTerritoryId)
    ?? open.find((h) => h.address?.cityTerritoryId === wilayaTerritoryId)
    ?? null;
}
