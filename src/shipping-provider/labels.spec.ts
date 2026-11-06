import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { collectLabels } from './labels';

const pdf = async (pages: number) => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return Buffer.from(await doc.save()).toString('base64');
};
const pagesOf = async (b64: string) => (await PDFDocument.load(Buffer.from(b64, 'base64'))).getPageCount();
const noFetch = (async () => { throw new Error('no network'); }) as any;

test('company with a bulk label (ZR): one call, one file, its failures kept', async () => {
  let calls = 0;
  const provider: any = { orderLabels: async (t: string[]) => { calls++; return { type: 'url', data: 'https://zr/labels.html', failed: [t[1]] }; } };
  const res = await collectLabels(provider, ['A', 'B'], noFetch);
  assert.equal(calls, 1);
  assert.deepEqual(res, { files: [{ type: 'url', data: 'https://zr/labels.html' }], failed: ['B'] });
});

test('PDF labels one by one (Ecotrack, Maystro) are merged into one PDF; a failing parcel is reported', async () => {
  const one = await pdf(1);
  const provider: any = { orderLabel: async (t: string) => { if (t === 'X') throw new Error('not found'); return { type: 'pdf', data: one }; } };
  const res = await collectLabels(provider, ['A', 'X', 'B'], noFetch);
  assert.deepEqual(res.failed, ['X']);
  assert.equal(res.files.length, 1);
  assert.equal(res.files[0].type, 'pdf');
  assert.equal(await pagesOf(res.files[0].data), 2);
});

test('label links that are PDFs (Yalidine) are downloaded and merged; other links stay links', async () => {
  const two = Buffer.from(await pdf(2), 'base64');
  const fetchFn: any = async (url: string) => url.endsWith('.pdf')
    ? { ok: true, headers: { get: () => 'application/pdf' }, arrayBuffer: async () => two }
    : { ok: true, headers: { get: () => 'text/html' }, arrayBuffer: async () => Buffer.from('<html>') };
  const provider: any = { orderLabel: async (t: string) => ({ type: 'url', data: t === 'H' ? 'https://x/label.html' : `https://x/${t}.pdf` }) };
  const res = await collectLabels(provider, ['A', 'H', 'B'], fetchFn);
  assert.deepEqual(res.failed, []);
  assert.equal(res.files[0].type, 'pdf');
  assert.equal(await pagesOf(res.files[0].data), 4);
  assert.deepEqual(res.files[1], { type: 'url', data: 'https://x/label.html' });
});
