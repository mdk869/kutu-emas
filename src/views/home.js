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
    <h1>Senarai kutu</h1>
    <p class="lead">${list.length
      ? 'Semua kutu yang anda urus di telefon ini. Tekan untuk buka.'
      : 'Masukkan nama ahli, hantar satu link dalam group WhatsApp, dan setiap ahli cabut kad sendiri.'}</p>
    <div id="install"></div>
  </section>

  ${list.length ? `
  <section class="panel">
    <ul class="sessions">${list.map((s) => `<li><a href="#a=${esc(s.token)}"><b>${esc(s.group)}</b><span>${s.n} ahli · ${esc(fmtDate(s.at))}</span><span class="chev" aria-hidden="true">›</span></a></li>`).join('')}</ul>
    <p class="hint">Senarai ini disimpan dalam telefon ini sahaja.</p>
  </section>` : ''}

  <section class="panel quiet">
    <details class="more" id="addBox">
      <summary>Ada kutu dari telefon lain?</summary>
      <form id="addForm" class="stack" novalidate>
        <div class="field">
          <label for="addLink">Link admin</label>
          <input id="addLink" placeholder="Tampal link admin di sini" autocomplete="off" spellcheck="false" autocapitalize="off">
          <span class="hint">Tampal link admin untuk masukkan kutu yang dibuat di telefon atau browser lain.</span>
        </div>
        <p class="err" id="addErr" role="alert"></p>
        <button class="btn small" type="submit">Masukkan ke senarai</button>
      </form>
    </details>
  </section>

  ${list.length ? '' : `
  <section class="panel quiet">
    <h2>Anda ahli kutu?</h2>
    <p class="hint">Halaman ini untuk admin. Untuk cabut kad, tekan link yang admin hantar dalam group WhatsApp.</p>
  </section>`}`;

  setActionBar(`<a class="btn gold wide" href="#baru">+ Buat cabutan baru</a>`);
  installCard(app.querySelector('#install'));

  app.querySelector('#addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = app.querySelector('#addErr');
    const token = tokenFromLink(app.querySelector('#addLink').value);
    if (!token) { err.textContent = 'Link ini bukan link admin. Cuba salin semula link admin anda.'; return; }
    try {
      const v = await api.adminView(token);
      rememberSession({ token, group: v.group_name, n: v.n, at: v.created_at });
      toast('Kutu dimasukkan ke senarai.');
      location.hash = `a=${token}`;
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  return () => {};
}
