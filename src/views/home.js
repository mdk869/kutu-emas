import { api } from '../api.js';
import { auth } from '../auth.js';
import { esc, fmtDate, monthLabel, store, toast, setActionBar, ICON, armButton } from '../ui.js';
import { mountLogin } from './login.js';
import { installCard } from '../pwa.js';

const LEGACY_KEY = 'kutu-emas-sesi-saya'; // senarai lama dalam peranti (sebelum ada akaun)
export const REUSE_KEY = 'kutu-emas-guna-semula';

function tokenFromLink(text) {
  const m = String(text || '').match(/#a=([A-Za-z0-9_-]{16,})/) || String(text || '').match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

export function renderHome(app) {
  let tab = 'aktif';
  let list = null;
  let openMenu = null;
  let unmountLogin = null;
  const off = auth.onChange(() => draw());

  function landing() {
    setActionBar('');
    app.innerHTML = `
    <section class="panel hero-panel">
      <div class="eyebrow">Untuk penganjur kutu</div>
      <h1>Cabutan giliran kutu emas yang adil dan telus</h1>
      <p class="lead">Kunci senarai nama, kongsi satu pautan dalam group WhatsApp, dan setiap peserta cabut kad sendiri. Semua orang nampak setiap cabutan secara langsung.</p>
    </section>
    <section class="panel" id="loginBox"></section>
    <section class="panel quiet">
      <h2>Peserta?</h2>
      <p class="hint">Peserta tidak perlu log masuk. Buka sahaja pautan cabutan yang dikongsi oleh admin dalam group WhatsApp.</p>
    </section>`;
    unmountLogin = mountLogin(app.querySelector('#loginBox'), () => draw(), {
      lead: 'Log masuk untuk mencipta cabutan dan melihat semua rekod cabutan anda dari mana-mana telefon.',
    });
  }

  function itemHTML(s) {
    const done = s.status === 'done';
    return `<li class="sess">
      <a class="sess-main" href="#s=${s.session_id}">
        <span class="sess-top"><b>${esc(s.group_name)}</b><span class="status ${done ? 'done' : 'open'} sm">${done ? 'Selesai' : `Berjalan ${s.picked}/${s.n}`}</span></span>
        <span class="sess-sub">${s.n} peserta · bermula ${esc(monthLabel(s.start_month, 1))} · dicipta ${esc(fmtDate(s.created_at))}</span>
      </a>
      <button class="btn icon" type="button" data-menu="${s.session_id}" aria-label="Pilihan untuk ${esc(s.group_name)}" aria-expanded="${openMenu === s.session_id}">${ICON.dots}</button>
      <div class="pmenu" ${openMenu === s.session_id ? '' : 'hidden'}>
        <button class="menu-item" type="button" data-reuse="${s.session_id}">Guna semula senarai nama</button>
        <button class="menu-item" type="button" data-arch="${s.session_id}">${s.archived ? 'Pulihkan dari arkib' : 'Pindah ke arkib'}</button>
      </div>
    </li>`;
  }

  function dashboard() {
    const legacy = store.get(LEGACY_KEY, []);
    app.innerHTML = `
    <section class="panel hero-panel">
      <div class="row-between">
        <div class="min0">
          <div class="eyebrow">Admin</div>
          <h1>Cabutan saya</h1>
          <p class="muted acct">${esc(auth.email || '')}</p>
        </div>
        <button class="btn small ghost" id="logout" type="button">Log keluar</button>
      </div>
      <div id="install"></div>
    </section>

    ${legacy.length ? `
    <section class="panel notice">
      <p><b>${legacy.length} cabutan lama</b> dijumpai dalam telefon ini (dicipta sebelum ada akaun).</p>
      <button class="btn small gold" id="importLegacy" type="button">Masukkan ke akaun saya</button>
    </section>` : ''}

    <section class="panel">
      <div class="tabs" role="tablist">
        <button role="tab" class="tab ${tab === 'aktif' ? 'on' : ''}" data-tab="aktif" aria-selected="${tab === 'aktif'}">Aktif</button>
        <button role="tab" class="tab ${tab === 'arkib' ? 'on' : ''}" data-tab="arkib" aria-selected="${tab === 'arkib'}">Arkib</button>
      </div>
      ${list == null
        ? '<p class="muted">Memuatkan…</p>'
        : list.length
          ? `<ul class="sess-list">${list.map(itemHTML).join('')}</ul>`
          : `<p class="empty">${tab === 'aktif' ? 'Belum ada cabutan. Tekan "Cabutan baru" di bawah untuk mula.' : 'Tiada cabutan dalam arkib.'}</p>`}
    </section>

    <section class="panel quiet">
      <details class="more" id="claimBox">
        <summary>Tambah cabutan sedia ada</summary>
        <form id="claimForm" class="stack" novalidate>
          <div class="field">
            <label for="claimLink">Pautan admin lama</label>
            <input id="claimLink" placeholder="Tampal pautan yang mengandungi #a=…" autocomplete="off" spellcheck="false" autocapitalize="off">
            <span class="hint">Untuk cabutan yang dicipta sebelum ada akaun, atau dicipta di peranti lain.</span>
          </div>
          <p class="err" id="claimErr" role="alert"></p>
          <button class="btn small" type="submit">Tambah ke akaun saya</button>
        </form>
      </details>
    </section>`;

    const bar = setActionBar(`<a class="btn gold wide" href="#baru">+ Cabutan baru</a>`);
    bar.querySelector('a').addEventListener('click', () => store.set(REUSE_KEY, null));
    installCard(app.querySelector('#install'));
    bind();
  }

  function bind() {
    const $ = (s) => app.querySelector(s);
    $('#logout').onclick = () => { auth.logout(); toast('Anda telah log keluar.'); };
    app.querySelectorAll('[data-tab]').forEach((b) => {
      b.onclick = () => { tab = b.dataset.tab; list = null; openMenu = null; draw(); };
    });
    app.querySelectorAll('[data-menu]').forEach((b) => {
      b.onclick = () => { openMenu = openMenu === b.dataset.menu ? null : b.dataset.menu; draw(); };
    });
    app.querySelectorAll('[data-reuse]').forEach((b) => {
      b.onclick = () => {
        const s = list.find((x) => x.session_id === b.dataset.reuse);
        store.set(REUSE_KEY, { group: s.group_name, names: s.names });
        location.hash = 'baru';
      };
    });
    app.querySelectorAll('[data-arch]').forEach((b) => {
      b.onclick = async () => {
        const s = list.find((x) => x.session_id === b.dataset.arch);
        try {
          await api.setArchived(s.session_id, !s.archived);
          toast(s.archived ? 'Dipulihkan dari arkib.' : 'Dipindah ke arkib.');
          openMenu = null; await load();
        } catch (ex) { toast(ex.message, 'warn'); }
      };
    });
    $('#importLegacy')?.addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = 'Memasukkan…';
      const legacy = store.get(LEGACY_KEY, []);
      let ok = 0; const left = [];
      for (const s of legacy) {
        try { await api.claim(s.token); ok++; } catch { left.push(s); }
      }
      store.set(LEGACY_KEY, left);
      toast(left.length ? `${ok} dimasukkan. ${left.length} cabutan milik akaun lain dan tidak dimasukkan.` : `${ok} cabutan dimasukkan ke akaun anda.`, left.length ? 'warn' : 'ok');
      await load();
    });
    $('#claimForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = tokenFromLink($('#claimLink').value);
      const err = $('#claimErr');
      if (!t) { err.textContent = 'Pautan tidak dikenali. Pastikan ia pautan admin yang mengandungi #a=.'; return; }
      try {
        const id = await api.claim(t);
        toast('Cabutan ditambah ke akaun anda.');
        location.hash = `s=${id}`;
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  async function load() {
    try {
      list = await api.mySessions(tab === 'arkib');
    } catch (ex) {
      if (ex.code === 'KT401') { auth.logout(); return; }
      list = [];
      toast(ex.message, 'warn');
    }
    draw();
  }

  function draw() {
    if (unmountLogin) { unmountLogin(); unmountLogin = null; }
    if (!auth.loggedIn) { list = null; landing(); return; }
    dashboard();
    if (list == null) load();
  }

  draw();
  return () => { off(); if (unmountLogin) unmountLogin(); };
}
