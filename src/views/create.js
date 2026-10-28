import { api } from '../api.js';
import { auth } from '../auth.js';
import { esc, store, setActionBar } from '../ui.js';
import { normName } from '../fair.js';
import { mountLogin } from './login.js';
import { REUSE_KEY } from './home.js';

function nextMonth() {
  const d = new Date();
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

export function renderCreate(app) {
  if (!auth.loggedIn) {
    setActionBar('');
    app.innerHTML = `<section class="panel" id="loginBox"></section>`;
    return mountLogin(app.querySelector('#loginBox'), () => renderCreate(app), {
      lead: 'Cabutan disimpan atas nama akaun anda, supaya anda boleh buka semula dari mana-mana telefon.',
    });
  }
  const reuse = store.get(REUSE_KEY, null);
  store.set(REUSE_KEY, null);
  app.innerHTML = `
  <a class="back-link" href="#">‹ Cabutan saya</a>
  <section class="panel">
    <div>
      <h1>Cabutan baru</h1>
      <p class="lead">${reuse ? 'Senarai nama disalin daripada cabutan lepas. Semak dan ubah jika perlu.' : 'Masukkan nama peserta. Selepas dikunci, anda kongsi satu pautan dalam group dan setiap orang cabut kad sendiri.'}</p>
    </div>
    <form id="f" class="stack" novalidate>
      <div class="field">
        <label for="group">Nama kumpulan</label>
        <input id="group" maxlength="80" placeholder="Contoh: Kutu Emas Geng Pejabat" autocomplete="off" value="${esc(reuse?.group || '')}">
      </div>
      <div class="field">
        <label for="names">Nama peserta</label>
        <span class="hint">Satu nama satu baris. Boleh salin dan tampal terus dari WhatsApp.</span>
        <textarea id="names" rows="8" placeholder="Siti Aminah&#10;Rosnah&#10;Farid">${esc((reuse?.names || []).join('\n'))}</textarea>
        <ol class="chips" id="chips" aria-label="Senarai peserta"></ol>
        <span id="nameErr" class="warn-text" role="alert"></span>
      </div>
      <div class="field">
        <label for="start">Bulan pertama kutu</label>
        <input id="start" type="month" value="${nextMonth()}">
      </div>
      <details class="more">
        <summary>Pilihan tambahan</summary>
        <div class="field">
          <label for="luck">Nombor bertuah (pilihan)</label>
          <input id="luck" inputmode="numeric" maxlength="40" placeholder="Contoh: 4721" autocomplete="off">
          <span class="hint">Minta salah seorang peserta beri apa-apa nombor dalam group. Nombor ini digabungkan semasa kad disusun, jadi penganjur pun tidak boleh mengawal keputusan.</span>
        </div>
      </details>
      <p id="err" class="err" role="alert"></p>
    </form>
  </section>

  <section class="panel quiet">
    <h2>Bagaimana ia berfungsi</h2>
    <ol class="how-steps">
      <li><b>Anda kunci senarai.</b> Sistem susun kad emas secara rawak. Isinya dikunci dan tiada sesiapa boleh lihat.</li>
      <li><b>Kongsi satu pautan dalam group.</b> Setiap orang buka di telefon, pilih nama sendiri dan pilih satu kad.</li>
      <li><b>Kongsi keputusan dalam group.</b> Bila semua selesai, senarai giliran keluar dan disahkan adil secara automatik.</li>
    </ol>
  </section>`;

  const $ = (s) => app.querySelector(s);
  const bar = setActionBar(`<button class="btn gold wide" id="goMob" type="button">Kunci &amp; mula cabutan</button>`);
  const parse = () => $('#names').value.split('\n').map(normName).filter(Boolean);

  function checkNames() {
    const names = parse();
    const seen = new Set();
    const dups = new Set();
    names.forEach((n) => { const k = n.toLowerCase(); if (seen.has(k)) dups.add(k); seen.add(k); });
    $('#chips').innerHTML = names.map((n) => `<li class="${dups.has(n.toLowerCase()) ? 'dup' : ''}">${esc(n)}</li>`).join('');
    let msg = '';
    if (dups.size) msg = 'Ada nama yang sama. Tambah sesuatu untuk bezakan, contohnya "Ali (Kedai)".';
    else if (names.length > 24) msg = 'Maksimum 24 peserta.';
    else if (names.some((n) => n.length > 60)) msg = 'Ada nama yang terlalu panjang.';
    $('#nameErr').textContent = msg;
    const label = names.length >= 2 ? `Kunci &amp; mula cabutan (${names.length} orang)` : 'Kunci &amp; mula cabutan';
    bar.querySelector('#goMob').innerHTML = label;
    return { names, msg };
  }
  $('#names').addEventListener('input', checkNames);

  async function submit() {
    const { names, msg } = checkNames();
    const err = $('#err');
    err.textContent = '';
    if (names.length < 2) { err.textContent = 'Masukkan sekurang-kurangnya 2 nama peserta.'; $('#names').focus(); return; }
    if (msg) { err.textContent = msg; $('#names').focus(); return; }
    if (!$('#start').value) { err.textContent = 'Pilih bulan pertama kutu.'; return; }

    const btns = [bar.querySelector('#goMob')];
    btns.forEach((b) => { b.disabled = true; b.textContent = 'Menyusun kad…'; });
    try {
      const group = normName($('#group').value) || 'Kutu Emas';
      const { session_id } = await api.createSession(group, `${$('#start').value}-01`, names, normName($('#luck').value));
      location.hash = `s=${session_id}`;
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
