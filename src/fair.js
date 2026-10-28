// Semakan keadilan — mesti sama dengan kutu__perm dan kutu__commit dalam migrasi SQL.

const enc = new TextEncoder();

export const normName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

export const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export function fromHex(h) {
  if (!/^[0-9a-f]{64}$/i.test(h)) throw new Error('Kod benih mesti 64 aksara heks (0-9, a-f).');
  return new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

function u32be(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

/** Isi kad: hasil[k] = bulan untuk kad k+1. */
export async function cardMonths(seedBytes, n) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  let c = 0;
  for (let i = n - 1; i > 0; i--) {
    const m = i + 1;
    const limit = Math.floor(4294967296 / m) * m;
    let x;
    do {
      const buf = new Uint8Array(seedBytes.length + 4);
      buf.set(seedBytes);
      buf.set(u32be(c++), seedBytes.length);
      const h = await sha256(buf);
      x = new DataView(h.buffer).getUint32(0);
    } while (x >= limit);
    const j = x % m;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function commitHash(seedHex, names) {
  const text = 'kutu-emas:v1\n' + seedHex.toLowerCase() + '\n' + names.map(normName).join('\n');
  return toHex(await sha256(enc.encode(text)));
}

/** Semak semula keputusan: kira kod pengesahan dan isi setiap kad daripada benih + nama. */
export async function verify(seedHex, names) {
  const clean = names.map(normName).filter(Boolean);
  const seed = fromHex(seedHex.trim());
  return {
    hash: await commitHash(seedHex.trim(), clean),
    months: await cardMonths(seed, clean.length),
  };
}
