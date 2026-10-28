import { api } from '../api.js';
import { esc, fmtDate, store, toast, setActionBar } from '../ui.js';
import { installCard } from '../pwa.js';

// Rekod cabutan admin disimpan dalam peranti ini (tiada akaun).
export const SESSIONS_KEY = 'kutu-emas-sesi-saya';

export function rememberSession(entry) {
  const list = store.get(SESSIONS_KEY, []).filter((s) => s.token !== entry.token);
  store.set(SESSIONS_KEY, [entry, ...list].slice(0, 50));
}

function tokenFromLink(text) {
  const t = String(text || '').trim();
  const m = t.match(/#a=([A-Za-z0-9_-]{16,})/) || t.match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

export function renderHome(app) {
  const list = store.get(SESSIONS_KEY, []);
  app.innerHTML = `
  <section class="panel hero-panel">
    <div class="eyebrow">Admin</div>
    <h1>Cabutan saya</h1>
    <p class="lead">${list.length
      ? 'Ketik satu cabutan untuk buka papan admin.'
      : 'Kunci senarai nama, kongsi satu pautan dalam group WhatsApp, dan setiap peserta cabut kad sendiri.'}</p>
    <div id="install"></div>
  </section>

  ${list.length ? `
  <section class="panel">
    <ul class="sessions">${list.map((s) => `<li><a href="#a=${esc(s.token)}"><b>${esc(s.group)}</b><span>${s.n} peserta · ${esc(fmtDate(s.at))}</span><span class="chev" aria-hidden="true">›</span></a></li>`).join('')}</ul>
    <p class="hint">Senarai ini disimpan dalam peranti ini sahaja.</p>
  </section>` : ''}

  <section class="panel quiet">
    <details class="more" id="addBox">
      <summary>Tambah cabutan sedia ada</summary>
      <form id="addForm" class="stack" novalidate>
        <div class="field">
          <label for="addLink">Pautan admin</label>
          <input id="addLink" placeholder="Tampal pautan yang mengandungi #a=…" autocomplete="off" spellcheck="false" autocapitalize="off">
          <span class="hint">Untuk cabutan yang dicipta di pelayar atau telefon lain. Contohnya, selepas memasang aplikasi di iPhone.</span>
        </div>
        <p class="err" id="addErr" role="alert"></p>
        <button class="btn small" type="submit">Tambah ke senarai</button>
      </form>
    </details>
  </section>

  ${list.length ? '' : `
  <section class="panel quiet">
    <h2>Peserta?</h2>
    <p class="hint">Peserta tidak perlu buka halaman ini. Buka sahaja pautan cabutan yang dikongsi oleh admin dalam group WhatsApp.</p>
  </section>`}`;

  setActionBar(`<a class="btn gold wide" href="#baru">+ Cabutan baru</a>`);
  installCard(app.querySelector('#install'));

  app.querySelector('#addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = app.querySelector('#addErr');
    const token = tokenFromLink(app.querySelector('#addLink').value);
    if (!token) { err.textContent = 'Pautan tidak dikenali. Pastikan ia pautan admin yang mengandungi #a=.'; return; }
    try {
      const v = await api.adminView(token);
      rememberSession({ token, group: v.group_name, n: v.n, at: v.created_at });
      toast('Cabutan ditambah ke senarai.');
      location.hash = `a=${token}`;
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  return () => {};
}
