import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCommune, pickHub, wilayaRates, zrPhone, ZrHub, ZrTerritory } from './zr-rules';

// تشغيل: pnpm test
const W16: ZrTerritory = { id: 'w16', code: 16, name: 'Alger', nameArabic: 'الجزائر', level: 'wilaya', parentId: null };
const W2: ZrTerritory = { id: 'w2', code: 2, name: 'Chlef', nameArabic: 'الشلف', level: 'wilaya', parentId: null };
const c = (id: string, name: string, nameArabic: string, parentId = 'w16'): ZrTerritory => ({ id, code: 0, name, nameArabic, level: 'commune', parentId });
const TERR = [
  W16, W2,
  c('dely', 'Dely Ibrahim', 'دالي ابراهيم'),
  c('draria', 'Draria', 'الدرارية'),
  c('belouz', 'Mohamed Belouzdad', 'محمد بلوزداد'),
  c('casbah', 'Casbah', 'القصبة'),
  c('chlef', 'Chlef', 'الشلف', 'w2'),
];

test('commune: Arabic name first — it tells apart our rows that share a French name', () => {
  assert.equal(matchCommune(TERR, 16, { name: 'Dely Ibrahim', ar_name: 'الدرارية' })?.id, 'draria');
  assert.equal(matchCommune(TERR, 16, { name: 'Dely Ibrahim', ar_name: 'دالي إبراهيم' })?.id, 'dely');
});

test('commune: Arabic name when the French spelling differs', () => {
  assert.equal(matchCommune(TERR, 16, { name: 'La Kasbah', ar_name: 'القصبة' })?.id, 'casbah');
});

test('commune: close French spelling (accents, articles, dashes)', () => {
  assert.equal(matchCommune(TERR, 16, { name: 'Mohamed Belouizdad', ar_name: '' })?.id, 'belouz');
  assert.equal(matchCommune(TERR, 16, { name: 'DRARIA', ar_name: '' })?.id, 'draria');
});

test('commune: only inside the given wilaya; unknown → null', () => {
  assert.equal(matchCommune(TERR, 16, { name: 'Chlef', ar_name: 'الشلف' }), null);
  assert.equal(matchCommune(TERR, 2, { name: 'Chlef', ar_name: 'الشلف' })?.id, 'chlef');
  assert.equal(matchCommune(TERR, 33, { name: 'Illizi', ar_name: 'إيليزي' }), null);
  assert.equal(matchCommune(TERR, 16, { name: 'Tamanrasset', ar_name: 'تمنراست' }), null);
});

test('phone: international +213 format', () => {
  assert.equal(zrPhone('0551 23 45 67'), '+213551234567');
  assert.equal(zrPhone('+213551234567'), '+213551234567');
  assert.equal(zrPhone('00213 551234567'), '+213551234567');
});

test('rates: one row per wilaya with home / stopdesk / return prices', () => {
  const rows = wilayaRates([
    { toTerritoryCode: 16, toTerritoryName: 'Alger', toTerritoryLevel: 'wilaya', deliveryPrices: [
      { deliveryType: 'home', price: 400 }, { deliveryType: 'pickup-point', price: 300, discountedPrice: 250 }, { deliveryType: 'return', price: 150 }] },
    { toTerritoryCode: 7, toTerritoryName: 'Baraki', toTerritoryLevel: 'commune', deliveryPrices: [{ deliveryType: 'home', price: 1 }] },
    { toTerritoryName: 'Unknown', toTerritoryLevel: 'Unknown', deliveryPrices: [] },
  ]);
  assert.deepEqual(rows, [{ wilaya_id: 16, wilaya_name: 'Alger', home: 400, stopdesk: 250, return: 150 }]);
});

test('rates: a wilaya priced only per commune (Alger) gets the most common commune price', () => {
  const p = (home: number, desk: number) => [{ deliveryType: 'home', price: home }, { deliveryType: 'pickup-point', price: desk }, { deliveryType: 'return', price: 150 }];
  const rows = wilayaRates([
    { toTerritoryId: 'dely', toTerritoryLevel: 'commune', deliveryPrices: p(500, 380) },
    { toTerritoryId: 'draria', toTerritoryLevel: 'commune', deliveryPrices: p(500, 380) },
    { toTerritoryId: 'casbah', toTerritoryLevel: 'commune', deliveryPrices: p(600, 400) },
    { toTerritoryId: 'chlef', toTerritoryLevel: 'commune', deliveryPrices: p(900, 700) },
    { toTerritoryCode: 2, toTerritoryName: 'Chlef', toTerritoryLevel: 'wilaya', deliveryPrices: p(800, 600) },
  ], TERR);
  assert.deepEqual(rows, [
    { wilaya_id: 2, wilaya_name: 'Chlef', home: 800, stopdesk: 600, return: 150 },
    { wilaya_id: 16, wilaya_name: 'Alger', home: 500, stopdesk: 380, return: 150 },
  ]);
});

test('hub: visible pickup point in the commune, else in the wilaya, else null', () => {
  const h = (id: string, city: string, district: string, isPickupPoint = true, isVisible = true): ZrHub =>
    ({ id, isPickupPoint, isVisible, address: { cityTerritoryId: city, districtTerritoryId: district } });
  const hubs = [h('hidden', 'w16', 'draria', true, false), h('sort', 'w16', 'draria', false), h('alger', 'w16', 'casbah'), h('draria', 'w16', 'draria')];
  assert.equal(pickHub(hubs, 'w16', 'draria')?.id, 'draria');
  assert.equal(pickHub(hubs, 'w16', 'dely')?.id, 'alger');
  assert.equal(pickHub(hubs, 'w2', 'chlef'), null);
});
