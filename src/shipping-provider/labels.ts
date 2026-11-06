import { PDFDocument } from 'pdf-lib';
import { LabelResult, ShippingProviderContract } from './interfaces/shipping-provider.interface';

// ملصقات عدة طرود لحساب واحد ← أقل عدد من الملفات للطباعة:
//  - شركة لها طباعة جماعية (ZR): طلب واحد وملف واحد
//  - غيرها: ملصق لكل طرد؛ ملفات PDF (وروابط PDF مثل Yalidine) تُدمج في PDF واحد، والروابط الأخرى تبقى روابط

export type LabelsResult = { files: LabelResult[]; failed: string[] };
type FetchFn = (url: string) => Promise<{ ok: boolean; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>;

const CONCURRENCY = 4;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

/** رابط ملصق ← بايتات PDF إن كان PDF، وإلا null */
async function pdfFromUrl(url: string, fetchFn: FetchFn): Promise<Uint8Array | null> {
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const isPdf = /pdf/i.test(res.headers.get('content-type') ?? '') || String.fromCharCode(...bytes.slice(0, 4)) === '%PDF';
    return isPdf ? bytes : null;
  } catch {
    return null;
  }
}

export async function collectLabels(
  provider: Pick<ShippingProviderContract, 'orderLabel' | 'orderLabels'>,
  trackings: string[],
  fetchFn: FetchFn = fetch as unknown as FetchFn,
): Promise<LabelsResult> {
  if (provider.orderLabels) {
    const { failed = [], ...file } = await provider.orderLabels(trackings);
    return { files: [file], failed };
  }

  const failed: string[] = [];
  const pdfs: Uint8Array[] = [];
  const links: LabelResult[] = [];
  const results = await mapLimit(trackings, CONCURRENCY, async (t) => {
    try { return await provider.orderLabel(t); } catch { return null; }
  });
  for (const [i, label] of results.entries()) {
    if (!label?.data) { failed.push(trackings[i]); continue; }
    if (label.type === 'pdf') { pdfs.push(Buffer.from(label.data, 'base64')); continue; }
    const bytes = await pdfFromUrl(label.data, fetchFn);
    if (bytes) pdfs.push(bytes); else links.push({ type: 'url', data: label.data });
  }

  const files: LabelResult[] = [];
  if (pdfs.length) {
    const merged = await PDFDocument.create();
    for (const bytes of pdfs) {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      for (const page of await merged.copyPages(doc, doc.getPageIndices())) merged.addPage(page);
    }
    files.push({ type: 'pdf', data: Buffer.from(await merged.save()).toString('base64') });
  }
  return { files: [...files, ...links], failed };
}
