import { api } from '../api.js';
import { esc, fmtDate, store } from '../ui.js';
import { normName } from '../fair.js';

const SESSIONS_KEY = 'kutu-emas-sesi-saya';

function nextMonth() {
  const d = new Date();
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

export function renderCreate(app) {
  const mine = store.get(SESSIONS_KEY, []);
  app.innerHTML = `
  <div class="cols">
    <section class="panel">
      <h1>Cipta cabutan baru</h1>
      <p class="lead">Masukkan senarai peserta. Selepas dikunci, kad dikocok di server dan setiap peserta dapat pautan sendiri untuk cabut dari telefon.</p>
      <form id="f" class="stack" novalidate>
        <div class="field">
          <label for="group">Nama kumpulan</label>
          <input id="group" maxlength="80" placeholder="cth. Kutu Emas Geng Pejabat" autocomplete="off">
        </div>
        <div class="field">
          <label for="names">Nama peserta</label>
          <span class="hint">Satu baris satu nama. Boleh tampal terus dari WhatsApp.</span>
          <textarea id="names" rows="12" placeholder="Siti Aminah&#10;Rosnah&#10;Farid&#10;…"></textarea>
          <div class="name-meta"><span id="count" class="count">0 peserta</span><span id="nameErr" class="warn-text"></span></div>
        </div>
        <div class="field">
          <label for="start">Bulan pertama kutu</label>
          <input id="start" type="month" value="${nextMonth()}">
        </div>
        <div class="field">
          <label for="luck">Nombor bertuah peserta (pilihan)</label>
          <input id="luck" inputmode="numeric" maxlength="40" placeholder="cth. 4721" autocomplete="off">
          <span class="hint">Minta seorang peserta beri apa-apa nombor dalam group. Nombor ini dicampur ke dalam kocokan, jadi penganjur pun tidak boleh mengawal keputusan.</span>
        </div>
        <div id="err" class="err" role="alert"></div>
        <button class="btn gold" id="go" type="submit">Kunci senarai &amp; kocok kad</button>
        <p class="hint">Senarai tidak boleh diubah selepas dikunci.</p>
      </form>
    </section>

    <aside class="stack">
      <section class="panel">
        <h2>Cara ia berfungsi</h2>
        <ol class="how-steps">
          <li><b>Kunci senarai.</b> Server mengocok kad dan menjana kod pengesahan. Umumkan kod ini dalam group.</li>
          <li><b>Hantar pautan.</b> Setiap peserta dapat pautan peribadi. Mereka pilih satu kad tertutup dan nampak bulan sendiri.</li>
          <li><b>Kongsi keputusan.</b> Bila semua selesai, senarai penuh dan kod benih dibuka untuk semua. Sesiapa boleh semak keputusan tidak diubah.</li>
        </ol>
      </section>
      <section class="panel">
        <h2>Sesi saya</h2>
        ${mine.length
          ? `<ul class="sessions">${mine.map((s) => `<li><a href="#a=${esc(s.token)}"><b>${esc(s.group)}</b><span>${s.n} peserta · ${esc(fmtDate(s.at))}</span></a></li>`).join('')}</ul>
             <p class="hint">Disimpan dalam pelayar ini saja. Simpan pautan admin anda di tempat lain juga.</p>`
          : `<p class="empty">Belum ada sesi pada peranti ini. Sesi yang anda cipta akan tersenarai di sini.</p>`}
      </section>
    </aside>
  </div>`;

  const $ = (s) => app.querySelector(s);
  const parse = () => $('#names').value.split('\n').map(normName).filter(Boolean);

  function checkNames() {
    const names = parse();
    $('#count').textContent = `${names.length} peserta`;
    const seen = new Set();
    const dup = names.find((n) => (seen.has(n.toLowerCase()) ? true : (seen.add(n.toLowerCase()), false)));
    let msg = '';
    if (dup) msg = `"${dup}" berulang.`;
    else if (names.length > 24) msg = 'Maksimum 24 peserta.';
    else if (names.some((n) => n.length > 60)) msg = 'Ada nama melebihi 60 aksara.';
    $('#nameErr').textContent = msg;
    return { names, msg };
  }
  $('#names').addEventListener('input', checkNames);

  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { names, msg } = checkNames();
    const err = $('#err');
    err.textContent = '';
    if (names.length < 2) { err.textContent = 'Masukkan sekurang-kurangnya 2 nama peserta.'; return; }
    if (msg) { err.textContent = msg; return; }
    if (!$('#start').value) { err.textContent = 'Pilih bulan pertama kutu.'; return; }

    const btn = $('#go');
    btn.disabled = true;
    btn.textContent = 'Mengocok kad…';
    try {
      const group = normName($('#group').value) || 'Kutu Emas';
      const { admin_token } = await api.createSession(group, `${$('#start').value}-01`, names, normName($('#luck').value));
      store.set(SESSIONS_KEY, [{ token: admin_token, group, n: names.length, at: new Date().toISOString() }, ...mine].slice(0, 20));
      location.hash = `a=${admin_token}`;
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = 'Kunci senarai & kocok kad';
    }
  });

  return () => {};
}
