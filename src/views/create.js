import { api } from '../api.js';
import { setActionBar, esc } from '../ui.js';
import { normName } from '../fair.js';
import { rememberSession } from './home.js';

function nextMonth() {
  const d = new Date();
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

export function renderCreate(app) {
  app.innerHTML = `
  <a class="back-link" href="#">‹ Senarai kutu</a>
  <section class="panel">
    <div>
      <h1>Buat cabutan baru</h1>
      <p class="lead">Masukkan nama ahli kutu. Lepas itu, hantar satu link dalam group dan setiap ahli cabut kad sendiri.</p>
    </div>
    <form id="f" class="stack" novalidate>
      <div class="field">
        <label for="group">Nama group kutu</label>
        <input id="group" maxlength="80" placeholder="Contoh: Kutu Emas Geng Pejabat" autocomplete="off">
      </div>
      <div class="field">
        <label for="names">Nama ahli</label>
        <span class="hint">Satu nama satu baris. Boleh copy dan paste terus dari WhatsApp.</span>
        <textarea id="names" rows="8" placeholder="Siti Aminah&#10;Rosnah&#10;Farid"></textarea>
        <ol class="chips" id="chips" aria-label="Senarai ahli"></ol>
        <span id="nameErr" class="warn-text" role="alert"></span>
      </div>
      <div class="field">
        <label for="start">Kutu mula bulan</label>
        <input id="start" type="month" value="${nextMonth()}">
      </div>
      <details class="more">
        <summary>Lagi pilihan</summary>
        <div class="field">
          <label for="luck">Nombor bertuah (pilihan)</label>
          <input id="luck" inputmode="numeric" maxlength="40" placeholder="Contoh: 4721" autocomplete="off">
          <span class="hint">Minta mana-mana ahli bagi satu nombor dalam group. Nombor ini dicampur masa kad disusun, jadi admin pun tak boleh kawal keputusan.</span>
        </div>
      </details>
      <p id="err" class="err" role="alert"></p>
    </form>
  </section>

  <section class="panel quiet">
    <h2>Macam mana ia berfungsi</h2>
    <ol class="how-steps">
      <li><b>Masukkan nama ahli.</b> Sistem susun kad emas secara rawak dan kunci isinya. Tiada siapa boleh tengok.</li>
      <li><b>Hantar satu link dalam group.</b> Setiap ahli tekan link, pilih nama sendiri dan pilih satu kad.</li>
      <li><b>Kongsi keputusan.</b> Bila semua dah cabut, senarai giliran keluar dan disemak secara automatik.</li>
    </ol>
  </section>`;

  const $ = (s) => app.querySelector(s);
  const bar = setActionBar(`<button class="btn gold wide" id="goMob" type="button">Mula cabutan</button>`);
  const parse = () => $('#names').value.split('\n').map(normName).filter(Boolean);

  function checkNames() {
    const names = parse();
    const seen = new Set();
    const dups = new Set();
    names.forEach((n) => { const k = n.toLowerCase(); if (seen.has(k)) dups.add(k); seen.add(k); });
    $('#chips').innerHTML = names.map((n) => `<li class="${dups.has(n.toLowerCase()) ? 'dup' : ''}">${esc(n)}</li>`).join('');
    let msg = '';
    if (dups.size) msg = 'Ada nama yang sama. Tambah sesuatu untuk bezakan, contohnya "Ali (Kedai)".';
    else if (names.length > 24) msg = 'Maksimum 24 ahli.';
    else if (names.some((n) => n.length > 60)) msg = 'Ada nama yang terlalu panjang.';
    $('#nameErr').textContent = msg;
    const label = names.length >= 2 ? `Mula cabutan (${names.length} orang)` : 'Mula cabutan';
    bar.querySelector('#goMob').innerHTML = label;
    return { names, msg };
  }
  $('#names').addEventListener('input', checkNames);

  async function submit() {
    const { names, msg } = checkNames();
    const err = $('#err');
    err.textContent = '';
    if (names.length < 2) { err.textContent = 'Masukkan sekurang-kurangnya 2 nama.'; $('#names').focus(); return; }
    if (msg) { err.textContent = msg; $('#names').focus(); return; }
    if (!$('#start').value) { err.textContent = 'Pilih bulan kutu mula.'; return; }

    const btns = [bar.querySelector('#goMob')];
    btns.forEach((b) => { b.disabled = true; b.textContent = 'Sedang sediakan kad…'; });
    try {
      const group = normName($('#group').value) || 'Kutu Emas';
      const { admin_token } = await api.createSession(group, `${$('#start').value}-01`, names, normName($('#luck').value));
      rememberSession({ token: admin_token, group, n: names.length, at: new Date().toISOString() });
      location.hash = `a=${admin_token}`;
    } catch (ex) {
      err.textContent = ex.message;
      err.scrollIntoView({ block: 'center', behavior: 'smooth' });
      btns.forEach((b) => { b.disabled = false; });
      checkNames();
    }
  }
  $('#f').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  bar.querySelector('#goMob').addEventListener('click', submit);
  checkNames();

  return () => {};
}
