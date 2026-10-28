import { esc, shortCode } from '../ui.js';
import { verify } from '../fair.js';

export function renderVerify(app) {
  app.innerHTML = `
  <section class="panel">
    <div>
      <h1>Semak sendiri</h1>
      <p class="lead">Halaman keputusan dah semak secara automatik. Halaman ini untuk sesiapa yang nak semak sendiri, guna maklumat dari bahagian "Nak semak sendiri?".</p>
    </div>
    <form id="vf" class="stack" novalidate>
      <div class="field">
        <label for="vSeed">Kod rawak asal</label>
        <input id="vSeed" class="mono" placeholder="64 aksara" autocomplete="off" spellcheck="false" autocapitalize="off">
      </div>
      <div class="field">
        <label for="vNames">Nama ahli</label>
        <span class="hint">Satu nama satu baris, ikut susunan asal masa cabutan dibuat.</span>
        <textarea id="vNames" rows="8"></textarea>
      </div>
      <div class="field">
        <label for="vHash">Kod Kunci yang admin umumkan (kalau ada)</label>
        <input id="vHash" placeholder="Contoh: EMAS-K7M2-Q9XT" autocomplete="off" spellcheck="false" autocapitalize="characters">
      </div>
      <button class="btn gold wide" type="submit">Semak</button>
    </form>
    <div id="vOut" class="verify-out" aria-live="polite"></div>
  </section>

  <section class="panel quiet">
    <h2>Kenapa cabutan ini adil?</h2>
    <ul class="how">
      <li><b>Sistem yang susun kad secara rawak</b>, bukan admin. Boleh dicampur dengan nombor bertuah dari ahli.</li>
      <li><b>Dikunci sebelum mula.</b> Kod Kunci ialah "cap jari" susunan kad. Kalau isi kad diubah sedikit pun, Kod Kunci akan berubah.</li>
      <li><b>Tiada siapa boleh intai.</b> Isi kad disimpan dalam sistem. Admin pun hanya nampak kad yang dah dibuka.</li>
    </ul>
  </section>`;

  app.querySelector('#vf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = app.querySelector('#vOut');
    const seed = app.querySelector('#vSeed').value.trim().toLowerCase();
    const names = app.querySelector('#vNames').value.split('\n').map((s) => s.trim()).filter(Boolean);
    const expected = app.querySelector('#vHash').value.trim().toUpperCase().replace(/\s+/g, '');
    if (names.length < 2) { out.innerHTML = '<p class="bad">Masukkan sekurang-kurangnya 2 nama.</p>'; return; }
    try {
      const r = await verify(seed, names);
      const code = shortCode(r.hash);
      const match = expected && (expected === code || expected.toLowerCase() === r.hash);
      const verdict = expected
        ? match
          ? '<p class="ok">✓ Sama dengan Kod Kunci yang diumumkan. Keputusan tidak diubah.</p>'
          : '<p class="bad">Tak sama. Semak ejaan dan susunan nama, dan kod rawak asal.</p>'
        : '';
      out.innerHTML = `${verdict}
        <div><span class="lbl">Kod Kunci dikira</span><div class="code big-code">${code}</div></div>
        <div><span class="lbl">Isi setiap kad</span>
        <div class="map">${r.months.map((m, i) => `<span>Kad ${i + 1} → Bulan ${m}</span>`).join('')}</div></div>`;
    } catch (ex) {
      out.innerHTML = `<p class="bad">${esc(ex.message)}</p>`;
    }
  });

  return () => {};
}
