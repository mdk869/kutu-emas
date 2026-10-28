import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardMonths, commitHash, verify, fromHex } from '../src/fair.js';

// Vektor ini dijana oleh fungsi SQL kutu__perm / kutu__commit.
// Jika ujian ini gagal, pelayar dan server tidak lagi bersetuju — jangan merge.
const SEED = '07'.repeat(32);

test('sama dengan server: isi kad', async () => {
  assert.deepEqual(await cardMonths(fromHex(SEED), 12), [5, 1, 3, 11, 2, 12, 6, 10, 7, 9, 8, 4]);
});

test('sama dengan server: kod pengesahan (nama dinormalkan)', async () => {
  assert.equal(
    await commitHash(SEED, ['Siti  Aminah ', 'Rosnah', 'Farid']),
    '0f33bffa721ccaae32652de86a583c2cda91068163c2180715d560ca6cd8384b',
  );
});

test('setiap kocokan ialah susunan 1..n yang lengkap', async () => {
  for (let n = 2; n <= 24; n++) {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const m = await cardMonths(seed, n);
    assert.deepEqual([...m].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1));
  }
});

test('taburan sekata (setiap bulan berpeluang sama pada setiap kad)', async () => {
  const N = 3000, n = 12;
  const counts = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let t = 0; t < N; t++) {
    const m = await cardMonths(crypto.getRandomValues(new Uint8Array(32)), n);
    m.forEach((month, card) => counts[card][month - 1]++);
  }
  const expected = N / n; // 250
  for (const row of counts) for (const c of row) assert.ok(Math.abs(c - expected) < 80, `kiraan ${c} jauh dari ${expected}`);
});

test('kod benih tidak sah ditolak', async () => {
  await assert.rejects(() => verify('xyz', ['A', 'B']), /64 aksara/);
});

test('Kod Kunci: format tetap dan stabil', async () => {
  const { shortCode } = await import('../src/fair.js');
  const h = '0f33bffa721ccaae32652de86a583c2cda91068163c2180715d560ca6cd8384b';
  const code = shortCode(h);
  assert.match(code, /^EMAS-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(code, shortCode(h.toUpperCase()));
  assert.notEqual(code, shortCode('1' + h.slice(1)));
  assert.equal(code, 'EMAS-1WSV-ZYKJ');
});
