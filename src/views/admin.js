import { api } from '../api.js';
import {
  esc, monthLabel, fmtDate, groupLink, adminLink, waHref, copy, toast, ICON,
  armButton, resultsTable, resultsText, poll, confetti, shortCode, store, fairBox, runFairCheck, techDetails,
} from '../ui.js';
import { installCard } from '../pwa.js';
import { rememberSession, forgetSession } from './home.js';

/** Papan admin, dibuka melalui pautan admin (#a=<token>). */
export function renderAdmin(app, token) {
  let v = null;
  let wasDone = null;
  let openMenu = null;
  const fetchView = () => api.adminView(token);
  const doPick = (idx) => api.adminPick(token, idx);
  // Kunci 'dah umum' ikut Kod Kunci: bila senarai diedit, langkah umum keluar semula.
  const annKey = () => `kutu-emas-umum-${v.session_id}-${v.commit_hash.slice(0, 8)}`;
  app.innerHTML = `<div class="panel"><p class="muted">Sedang buka…</p></div>`;

  async function load() {
    try {
      v = await fetchView();
      // Pastikan cabutan ini ada dalam "Cabutan saya" pada peranti ini.
      rememberSession({ token, group: v.group_name, n: v.n, at: v.created_at });
      draw();
    } catch (e) {
      app.innerHTML = `<section class="panel"><h1>Kutu tidak dijumpai</h1><p class="lead">${esc(e.message)}</p>
        <div class="row-btns"><a class="btn" href="#">Ke senarai kutu</a><button class="btn ghost" id="forget" type="button">Buang dari senarai</button></div></section>`;
      app.querySelector('#forget').onclick = () => { forgetSession(token); location.hash = ''; };
    }
  }

  const announceText = () => (v.relocked_at
    ? `*${v.group_name}*\nSenarai ahli dah dikemas kini ✏️\nKad disusun semula dan Kod Kunci ditukar. Link cabutan masih sama.\n\n👉 ${groupLink(v.public_id)}\n\n🔒 Kod Kunci baru: *${shortCode(v.commit_hash)}*\n(Pastikan kod ini sama dengan kod di skrin anda.)`
    : `*${v.group_name}*\nCabutan giliran kutu emas dah dibuka 🎉\n\n1. Tekan link di bawah\n2. Pilih nama anda\n3. Pilih satu kad emas\n\nSemua orang boleh tengok setiap cabutan secara live.\n\n👉 ${groupLink(v.public_id)}\n\n🔒 Kod Kunci: *${shortCode(v.commit_hash)}*\n(Pastikan kod ini sama dengan kod di skrin anda.)`);

  function stepsHTML(done, picked) {
    const announced = store.get(annKey(), false);
    const step = (n, state, title, body) => `<li class="step ${state}"><span class="sn">${state === 'done' ? ICON.check : n}</span><div><b class="st">${title}</b>${body}</div></li>`;
    return `<ol class="steps">
      ${step(1, announced || picked > 0 ? 'done' : 'now', 'Hantar link cabutan dalam group', announced || picked > 0
        ? `<p><button class="linkish" id="copyGroup" type="button">Salin link cabutan</button></p>`
        : `<p>${v.relocked_at ? 'Senarai baru dikemas kini. Hantar Kod Kunci baru dalam group (link masih sama).' : 'Satu link untuk semua ahli. Tak perlu hantar satu-satu.'}</p><div class="row-btns"><a class="btn wa small" id="announce" href="${waHref(announceText())}" target="_blank" rel="noopener">${ICON.wa} Hantar ke group</a><button class="btn small" id="copyGroup" type="button">Salin link</button></div>`)}
      ${step(2, done ? 'done' : announced || picked > 0 ? 'now' : 'todo', 'Ahli cabut sendiri', done ? '' : `<p>${picked}/${v.n} dah cabut. Semua orang boleh tengok di <a href="#k=${v.public_id}">halaman live</a>.</p>`)}
      ${step(3, done ? 'now' : 'todo', 'Kongsi keputusan', done ? '<p>Semua dah cabut. Kongsi keputusan dalam group.</p>' : '<p>Boleh buat bila semua dah cabut.</p>')}
    </ol>`;
  }

  function rowHTML(p) {
    const picked = p.card != null;
    return `<li class="prow ${picked ? 'is-picked' : ''}">
      <div class="pinfo">
        <span class="pname">${esc(p.name)}</span>
        <span class="pstat">${picked
          ? `${ICON.check} Dah cabut${p.by_admin ? ' (oleh admin)' : ''}`
          : 'Belum cabut'}</span>
      </div>
      ${picked
        ? `<span class="pill got">Bulan ${p.month}</span>`
        : `<div class="pacts">
            <button class="btn icon" type="button" data-menu="${p.idx}" aria-label="Pilihan untuk ${esc(p.name)}" aria-expanded="${openMenu === p.idx}">${ICON.dots}</button>
          </div>
          <div class="pmenu" ${openMenu === p.idx ? '' : 'hidden'}>
            <button class="menu-item warn" type="button" data-pick="${p.idx}">Cabutkan untuk dia</button>
            <p class="hint">Sistem akan pilih kad secara rawak untuk ${esc(p.name)}, dan semua ahli akan nampak ia dicabut oleh admin. Guna kalau dia lambat atau tiada telefon.</p>
          </div>`}
    </li>`;
  }

  function draw() {
    const done = v.status === 'done';
    const picked = v.participants.filter((p) => p.card != null).length;
    if (wasDone === false && done) confetti();
    wasDone = done;

    app.innerHTML = `
    <a class="back-link" href="#">‹ Senarai kutu</a>
    <section class="panel hero-panel">
      <div class="row-between">
        <div class="min0">
          <div class="eyebrow">Admin</div>
          <h1>${esc(v.group_name)}</h1>
          <p class="muted">${v.n} ahli · mula ${esc(monthLabel(v.start_month, 1))}</p>
        </div>
        <span class="status ${done ? 'done' : 'open'}">${done ? 'Selesai' : 'Sedang berjalan'}</span>
      </div>
      <div class="progress-wrap">
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${v.n}" aria-valuenow="${picked}"><span style="width:${(picked / v.n) * 100}%"></span></div>
        <span class="progress">${picked}/${v.n}</span>
      </div>
      ${stepsHTML(done, picked)}
      <div id="install"></div>
    </section>

    ${done ? `
    <section class="panel">
      <h2>Giliran terima emas</h2>
      ${resultsTable(v.results, v.start_month)}
      ${fairBox()}
      <div class="stack-btns">
        <a class="btn wa wide" href="${waHref(resultsText(v))}" target="_blank" rel="noopener">${ICON.wa} Hantar keputusan ke group</a>
        <button class="btn wide" id="copyRes" type="button">Salin teks keputusan</button>
      </div>
    </section>` : ''}

    <section class="panel">
      <div class="row-between"><h2>Ahli</h2>${done ? '' : `<span class="count">${v.n - picked} belum cabut</span>`}</div>
      <ul class="plist">${v.participants.map(rowHTML).join('')}</ul>
    </section>

    ${done ? '' : `<section class="panel quiet">${lockBadgeAdmin()}</section>`}

    <section class="panel">
      <h2>Urus kutu</h2>
      <p class="hint">${picked > 0 ? 'Dah ada ahli yang cabut, jadi hanya nama group boleh diubah.' : 'Silap nama atau bulan? Anda boleh edit atau padam sebelum ada ahli yang cabut.'}</p>
      <div class="row-btns"><a class="btn small" href="#edit=${esc(token)}">${picked > 0 ? 'Tukar nama group' : 'Edit atau padam'}</a></div>
    </section>

    <section class="panel quiet">
      <h2>Link admin anda</h2>
      <p class="hint">Simpan link ini kalau nak buka halaman ini di telefon lain. Jangan kongsi dalam group.</p>
      <button class="btn small" id="copyAdmin" type="button">Salin link admin</button>
      ${done ? techDetails(v) : ''}
    </section>`;

    installCard(app.querySelector('#install'));
    bind();
    if (done) runFairCheck(app, v);
  }

  function lockBadgeAdmin() {
    return `<div class="trust"><span class="trust-ic">${ICON.lock}</span><span><b>Kad dah dikunci</b> pada ${esc(fmtDate(v.relocked_at || v.created_at))}. Admin pun tak boleh tengok kad yang belum dibuka.<span class="code-line">Kod Kunci: <b class="code">${shortCode(v.commit_hash)}</b></span></span></div>`;
  }

  function bind() {
    const $ = (s) => app.querySelector(s);
    $('#copyAdmin').onclick = () => copy(adminLink(token), 'Link admin disalin.');
    $('#copyRes')?.addEventListener('click', () => copy(resultsText(v), 'Teks keputusan disalin.'));
    $('#announce')?.addEventListener('click', () => { store.set(annKey(), true); setTimeout(draw, 300); });
    app.querySelectorAll('[data-menu]').forEach((b) => {
      b.onclick = () => { const i = +b.dataset.menu; openMenu = openMenu === i ? null : i; draw(); };
    });
    $('#copyGroup')?.addEventListener('click', () => copy(groupLink(v.public_id), 'Link cabutan disalin.'));
    app.querySelectorAll('[data-pick]').forEach((b) => {
      const idx = +b.dataset.pick;
      armButton(b, 'Tekan sekali lagi untuk teruskan', async () => {
        b.disabled = true;
        try {
          v = await doPick(idx);
          openMenu = null;
          const p = v.participants.find((x) => x.idx === idx);
          toast(`${p.name} dapat Bulan ${p.month}.`);
          draw();
        } catch (e) {
          toast(e.message, 'warn');
          b.disabled = false;
        }
      });
    });
  }

  // Lukis semula hanya bila data berubah dan tiada menu terbuka.
  const stop = poll(async () => {
    if (!v || v.status === 'done' || openMenu != null) return;
    const nv = await fetchView();
    if (JSON.stringify(nv) !== JSON.stringify(v)) { v = nv; draw(); }
  });
  load();
  return stop;
}
