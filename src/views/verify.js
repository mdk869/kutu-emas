import { esc, groupHash } from '../ui.js';
import { verify } from '../fair.js';

export function renderVerify(app) {
  app.innerHTML = `
  <div class="cols">
    <section class="panel">
      <h1>Semak keputusan</h1>
      <p class="lead">Masukkan kod benih dan senarai nama peserta (ikut susunan asal). Halaman ini mengira semula kod pengesahan dan isi setiap kad di dalam telefon anda sendiri.</p>
      <form id="vf" class="stack" novalidate>
        <div class="field">
          <label for="vSeed">Kod benih</label>
          <input id="vSeed" class="mono" placeholder="64 aksara heks" autocomplete="off" spellcheck="false">
        </div>
        <div class="field">
          <label for="vNames">Senarai nama</label>
          <span class="hint">Satu baris satu nama, ikut susunan asal semasa sesi dicipta.</span>
          <textarea id="vNames" rows="10"></textarea>
        </div>
        <div class="field">
          <label for="vHash">Kod pengesahan yang diumumkan (pilihan)</label>
          <input id="vHash" class="mono" placeholder="untuk dibandingkan" autocomplete="off" spellcheck="false">
        </div>
        <button class="btn gold" type="submit">Semak</button>
      </form>
      <div id="vOut" class="verify-out" aria-live="polite"></div>
    </section>
    <aside class="panel">
      <h2>Kenapa ini adil</h2>
      <ul class="how">
        <li><b>Rawak kriptografi.</b> Kod benih dijana di server dengan penjana rawak selamat, dan boleh dicampur dengan nombor bertuah peserta.</li>
        <li><b>Dikunci dulu.</b> Kod pengesahan ialah cap jari (SHA-256) kod benih + senarai nama. Ia diumumkan sebelum sesiapa cabut, jadi kad tidak boleh diubah selepas itu.</li>
        <li><b>Tiada siapa boleh intai.</b> Isi kad hanya di server. Admin pun cuma nampak bulan bagi kad yang sudah dibuka.</li>
        <li><b>Boleh disemak.</b> Kod benih yang sama sentiasa menghasilkan susunan kad yang sama.</li>
      </ul>
    </aside>
  </div>`;

  app.querySelector('#vf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = app.querySelector('#vOut');
    const seed = app.querySelector('#vSeed').value.trim().toLowerCase();
    const names = app.querySelector('#vNames').value.split('\n').map((s) => s.trim()).filter(Boolean);
    const expected = app.querySelector('#vHash').value.replace(/\s+/g, '').toLowerCase();
    if (names.length < 2) { out.innerHTML = '<span class="bad">Masukkan sekurang-kurangnya 2 nama.</span>'; return; }
    try {
      const r = await verify(seed, names);
      const verdict = expected
        ? r.hash === expected
          ? '<p class="ok">✓ Sepadan dengan kod pengesahan yang diumumkan. Keputusan tidak diubah.</p>'
          : '<p class="bad">Tidak sepadan. Semak ejaan dan susunan nama, serta kod benih.</p>'
        : '';
      out.innerHTML = `${verdict}
        <div><span class="lbl">Kod pengesahan dikira</span><div class="mono">${groupHash(r.hash)}</div></div>
        <div><span class="lbl">Isi setiap kad</span>
        <div class="map">${r.months.map((m, i) => `<span>Kad ${i + 1} → Bulan ${m}</span>`).join('')}</div></div>`;
    } catch (ex) {
      out.innerHTML = `<span class="bad">${esc(ex.message)}</span>`;
    }
  });

  return () => {};
}
