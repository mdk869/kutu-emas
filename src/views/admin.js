import { api } from '../api.js';
import {
  esc, monthLabel, fmtDate, groupLink, adminLink, waHref, copy, toast, ICON,
  armButton, resultsTable, resultsText, poll, confetti, shortCode, store, fairBox, runFairCheck, techDetails,
} from '../ui.js';
import { installCard } from '../pwa.js';
import { rememberSession } from './home.js';

/** Papan admin, dibuka melalui pautan admin (#a=<token>). */
export function renderAdmin(app, token) {
  let v = null;
  let wasDone = null;
  let openMenu = null;
  const fetchView = () => api.adminView(token);
  const doPick = (idx) => api.adminPick(token, idx);
  const annKey = () => `kutu-emas-umum-${v.session_id}`;
  app.innerHTML = `<div class="panel"><p class="muted">Memuatkan…</p></div>`;

  async function load() {
    try {
      v = await fetchView();
      // Pastikan cabutan ini ada dalam "Cabutan saya" pada peranti ini.
      rememberSession({ token, group: v.group_name, n: v.n, at: v.created_at });
      draw();
    } catch (e) {
      app.innerHTML = `<section class="panel"><h1>Cabutan tidak dijumpai</h1><p class="lead">${esc(e.message)}</p><a class="btn" href="#">Ke Cabutan saya</a></section>`;
    }
  }

  const announceText = () =>
    `*${v.group_name}*\nCabutan giliran kutu emas sudah dibuka 🎉\n\n1. Tekan pautan di bawah\n2. Pilih nama anda\n3. Pilih satu kad emas\n\nSetiap cabutan dipaparkan kepada semua orang secara langsung.\n\n👉 ${groupLink(v.public_id)}\n\n🔒 Kod Kunci: *${shortCode(v.commit_hash)}*\n(Pastikan kod ini sama dengan kod di skrin anda.)`;

  function stepsHTML(done, picked) {
    const announced = store.get(annKey(), false);
    const step = (n, state, title, body) => `<li class="step ${state}"><span class="sn">${state === 'done' ? ICON.check : n}</span><div><b class="st">${title}</b>${body}</div></li>`;
    return `<ol class="steps">
      ${step(1, announced || picked > 0 ? 'done' : 'now', 'Kongsi pautan cabutan dalam group', announced || picked > 0
        ? `<p><button class="linkish" id="copyGroup" type="button">Salin pautan cabutan</button></p>`
        : `<p>Satu pautan untuk semua peserta. Tiada perlu hantar secara peribadi.</p><div class="row-btns"><a class="btn wa small" id="announce" href="${waHref(announceText())}" target="_blank" rel="noopener">${ICON.wa} Kongsi ke group</a><button class="btn small" id="copyGroup" type="button">Salin pautan</button></div>`)}
      ${step(2, done ? 'done' : announced || picked > 0 ? 'now' : 'todo', 'Peserta cabut sendiri', done ? '' : `<p>${picked}/${v.n} sudah cabut. Semua orang nampak setiap cabutan di <a href="#k=${v.public_id}">papan langsung</a>.</p>`)}
      ${step(3, done ? 'now' : 'todo', 'Kongsi keputusan', done ? '<p>Semua sudah cabut. Kongsi keputusan dalam group.</p>' : '<p>Boleh dibuat selepas semua selesai.</p>')}
    </ol>`;
  }

  function rowHTML(p) {
    const picked = p.card != null;
    return `<li class="prow ${picked ? 'is-picked' : ''}">
      <div class="pinfo">
        <span class="pname">${esc(p.name)}</span>
        <span class="pstat">${picked
          ? `${ICON.check} Sudah cabut${p.by_admin ? ' (oleh admin)' : ''}`
          : 'Belum cabut'}</span>
      </div>
      ${picked
        ? `<span class="pill got">Bulan ${p.month}</span>`
        : `<div class="pacts">
            <button class="btn icon" type="button" data-menu="${p.idx}" aria-label="Pilihan untuk ${esc(p.name)}" aria-expanded="${openMenu === p.idx}">${ICON.dots}</button>
          </div>
          <div class="pmenu" ${openMenu === p.idx ? '' : 'hidden'}>
            <button class="menu-item warn" type="button" data-pick="${p.idx}">Cabut bagi pihaknya</button>
            <p class="hint">Sistem pilih kad secara rawak untuk ${esc(p.name)}, dan semua peserta akan nampak ia dicabut oleh admin. Gunakan hanya jika dia lambat atau tiada telefon.</p>
          </div>`}
    </li>`;
  }

  function draw() {
    const done = v.status === 'done';
    const picked = v.participants.filter((p) => p.card != null).length;
    if (wasDone === false && done) confetti();
    wasDone = done;

    app.innerHTML = `
    <a class="back-link" href="#">‹ Cabutan saya</a>
    <section class="panel hero-panel">
      <div class="row-between">
        <div class="min0">
          <div class="eyebrow">Admin</div>
          <h1>${esc(v.group_name)}</h1>
          <p class="muted">${v.n} peserta · bermula ${esc(monthLabel(v.start_month, 1))}</p>
        </div>
        <span class="status ${done ? 'done' : 'open'}">${done ? 'Selesai' : 'Berjalan'}</span>
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
      <h2>Senarai giliran</h2>
      ${resultsTable(v.results, v.start_month)}
      ${fairBox()}
      <div class="stack-btns">
        <a class="btn wa wide" href="${waHref(resultsText(v))}" target="_blank" rel="noopener">${ICON.wa} Kongsi keputusan ke group</a>
        <button class="btn wide" id="copyRes" type="button">Salin teks keputusan</button>
      </div>
    </section>` : ''}

    <section class="panel">
      <div class="row-between"><h2>Peserta</h2>${done ? '' : `<span class="count">${v.n - picked} belum cabut</span>`}</div>
      <ul class="plist">${v.participants.map(rowHTML).join('')}</ul>
    </section>

    ${done ? '' : `<section class="panel quiet">${lockBadgeAdmin()}</section>`}

    <section class="panel quiet">
      <h2>Simpan pautan admin</h2>
      <p class="hint">Pautan ini untuk anda sahaja, untuk buka halaman ini dari peranti lain. Jangan kongsi dalam group.</p>
      <button class="btn small" id="copyAdmin" type="button">Salin pautan admin</button>
      ${done ? techDetails(v) : ''}
    </section>`;

    installCard(app.querySelector('#install'));
    bind();
    if (done) runFairCheck(app, v);
  }

  function lockBadgeAdmin() {
    return `<div class="trust"><span class="trust-ic">${ICON.lock}</span><span><b>Kad dikunci</b> pada ${esc(fmtDate(v.created_at))}. Anda sebagai admin pun tidak boleh lihat isi kad yang belum dibuka.<span class="code-line">Kod Kunci: <b class="code">${shortCode(v.commit_hash)}</b></span></span></div>`;
  }

  function bind() {
    const $ = (s) => app.querySelector(s);
    $('#copyAdmin').onclick = () => copy(adminLink(token), 'Pautan admin disalin.');
    $('#copyRes')?.addEventListener('click', () => copy(resultsText(v), 'Teks keputusan disalin.'));
    $('#announce')?.addEventListener('click', () => { store.set(annKey(), true); setTimeout(draw, 300); });
    app.querySelectorAll('[data-menu]').forEach((b) => {
      b.onclick = () => { const i = +b.dataset.menu; openMenu = openMenu === i ? null : i; draw(); };
    });
    $('#copyGroup')?.addEventListener('click', () => copy(groupLink(v.public_id), 'Pautan cabutan disalin.'));
    app.querySelectorAll('[data-pick]').forEach((b) => {
      const idx = +b.dataset.pick;
      armButton(b, 'Tekan sekali lagi untuk sahkan', async () => {
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
