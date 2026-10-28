import { api } from '../api.js';
import {
  esc, monthLabel, fmtDate, cardHTML, resultsTable, toast, poll, confetti, lockBadge, fairBox,
  runFairCheck, techDetails, calendarHref, setActionBar, store, ICON,
} from '../ui.js';

/**
 * Halaman utama peserta: SATU pautan group (#k=…).
 * Peringkat: board (pilih nama) → confirm ("Anda Rosnah?") → pick (pilih kad) → board dengan keputusan sendiri.
 * Setiap kad yang dibuka dipaparkan kepada semua di papan langsung.
 */
export function renderGroup(app, publicId) {
  const meKey = `kutu-emas-saya-${publicId}`;
  let v = null;
  let stage = 'board';
  let candidate = null; // idx nama yang sedang disahkan / memilih
  let selected = null;
  let busy = false;
  let justOpened = false;
  let seen = null; // idx yang sudah dipaparkan di papan langsung
  let me = store.get(meKey, null);

  app.innerHTML = `<div class="panel"><p class="muted">Sedang buka…</p></div>`;

  const person = (idx) => v.people.find((p) => p.idx === idx);
  const picked = () => v.people.filter((p) => p.card != null);
  const firstName = (n) => n.split(' ')[0];

  /* ---------- Bahagian ---------- */

  function heroHTML() {
    const done = v.status === 'done';
    let title = 'Pilih nama anda';
    let lead = 'Tekan nama anda untuk mula. Semua orang boleh tengok setiap cabutan secara live.';
    if (done) { title = 'Keputusan cabutan'; lead = 'Semua dah cabut. Ini giliran terima emas.'; }
    else if (stage === 'confirm') { title = 'Betul ini nama anda?'; lead = ''; }
    else if (stage === 'pick') { title = `${esc(firstName(person(candidate).name))}, pilih satu kad`; lead = 'Semua kad ada peluang yang sama.'; }
    else if (me != null && person(me)?.card != null) { title = 'Anda dah cabut'; lead = 'Senarai penuh akan keluar bila semua dah cabut.'; }
    return `<section class="panel hero-panel">
      <div class="eyebrow">${esc(v.group_name)}</div>
      <h1>${title}</h1>
      ${lead ? `<p class="lead">${lead}</p>` : ''}
    </section>`;
  }

  function mineHTML() {
    const m = person(me);
    return `<section class="panel mine">
      <div class="mine-card">${cardHTML(m.card, { open: !justOpened, reveal: true, month: m.month, start: v.start_month })}</div>
      <p class="mine-lead">${esc(firstName(m.name))}, giliran anda terima emas pada:</p>
      <div class="big">${esc(monthLabel(v.start_month, m.month))}</div>
      <p class="muted">Giliran ke-${m.month} daripada ${v.n}${m.by_admin ? ' · dicabut oleh admin bagi pihak anda' : ''}</p>
      <a class="btn wide" href="${calendarHref(v.group_name, v.start_month, m.month)}" target="_blank" rel="noopener">${ICON.cal} Simpan dalam kalendar</a>
      ${v.status === 'done' ? '' : '<button class="btn ghost wide" id="other" type="button">Cabut untuk ahli lain guna telefon ini</button>'}
    </section>`;
  }

  function namesHTML() {
    const left = v.people.filter((p) => p.card == null);
    return `<section class="panel">
      <div class="row-between"><h2>Nama anda yang mana?</h2><span class="count">${left.length} belum cabut</span></div>
      <div class="names-grid">${left.map((p) => `<button type="button" class="name-btn" data-name="${p.idx}">${esc(p.name)}</button>`).join('')}</div>
    </section>`;
  }

  function confirmHTML() {
    const p = person(candidate);
    return `<section class="panel confirm-panel">
      <p class="muted">Anda akan cabut kad sebagai</p>
      <div class="confirm-name">${esc(p.name)}</div>
      <p class="hint">Semua ahli akan nampak cabutan ini, dan ia tak boleh dibatalkan.</p>
    </section>`;
  }

  function pickHTML() {
    const taken = new Set(v.people.filter((p) => p.card != null).map((p) => p.card));
    return `<section class="panel stage">
      <div class="cards" id="cards">${Array.from({ length: v.n }, (_, i) => i + 1)
        .map((c) => cardHTML(c, { taken: taken.has(c), selected: selected === c })).join('')}</div>
      <p class="hint center">Kad gelap dah diambil orang. Tiada siapa tahu isi kad yang belum dibuka, termasuk admin.</p>
    </section>`;
  }

  function boardHTML() {
    const list = picked().sort((a, b) => new Date(b.picked_at) - new Date(a.picked_at));
    return `<section class="panel">
      <div class="row-between"><h2>Siapa dah cabut</h2><span class="live"><span class="live-dot"></span>Live</span></div>
      <div class="progress-wrap">
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${v.n}" aria-valuenow="${list.length}"><span style="width:${(list.length / v.n) * 100}%"></span></div>
        <span class="progress">${list.length}/${v.n}</span>
      </div>
      ${list.length
        ? `<ol class="feed">${list.map((p) => `<li class="${seen && !seen.has(p.idx) ? 'new' : ''} ${p.idx === me ? 'me' : ''}">
            <span class="feed-m">${p.month}</span>
            <span class="feed-t"><b>${esc(p.name)}</b> dapat <b>${esc(monthLabel(v.start_month, p.month))}</b> (Kad ${p.card})
            <small>${esc(fmtDate(p.picked_at))}${p.by_admin ? ' · dicabut oleh admin' : ''}</small></span></li>`).join('')}</ol>`
        : '<p class="empty">Belum ada yang cabut. Bila ada, ia akan keluar di sini terus.</p>'}
    </section>`;
  }

  function doneHTML() {
    return `<section class="panel">
      <h2>Giliran terima emas</h2>
      ${resultsTable(v.results, v.start_month, me != null ? person(me)?.name : null)}
      ${fairBox()}
      ${techDetails(v)}
    </section>`;
  }

  /* ---------- Lukis ---------- */

  function draw() {
    const done = v.status === 'done';
    const mePicked = me != null && person(me)?.card != null;
    let html = heroHTML();
    if (done) {
      if (mePicked) html += mineHTML();
      html += doneHTML();
    } else if (stage === 'confirm') {
      html += confirmHTML() + boardHTML();
    } else if (stage === 'pick') {
      html += pickHTML() + boardHTML();
    } else {
      if (mePicked) html += mineHTML();
      else html += namesHTML();
      html += boardHTML();
    }
    if (!done) html += `<section class="panel quiet">${lockBadge(v)}</section>`;
    app.innerHTML = html;
    seen = new Set(picked().map((p) => p.idx));
    bind();
    updateBar();
    if (done) runFairCheck(app, v);
    if (justOpened) {
      justOpened = false;
      setTimeout(() => app.querySelector('.mine-card .card')?.classList.add('open'), 120);
      setTimeout(confetti, 700);
    }
  }

  function updateBar() {
    if (v.status === 'done' || stage === 'board') { setActionBar(''); return; }
    let bar;
    if (stage === 'confirm') {
      const name = esc(firstName(person(candidate).name));
      bar = setActionBar(`<div class="bar-row"><button class="btn" id="back" type="button">Bukan saya</button><button class="btn gold grow" id="yes" type="button">Ya, saya ${name}</button></div>`);
      bar.querySelector('#yes').onclick = () => { stage = 'pick'; selected = null; draw(); window.scrollTo(0, 0); };
    } else {
      bar = setActionBar(selected
        ? `<div class="bar-row"><button class="btn" id="back" type="button">Batal</button><button class="btn gold grow" id="openBtn" type="button">Buka Kad ${selected}</button></div>
           <p class="bar-note">Lepas buka, tak boleh tukar.</p>`
        : `<div class="bar-row"><button class="btn" id="back" type="button">Kembali</button><p class="bar-hint grow">Tekan satu kad</p></div>`);
      bar.querySelector('#openBtn')?.addEventListener('click', openCard);
    }
    bar.querySelector('#back').onclick = () => {
      if (stage === 'pick' && selected) { selected = null; draw(); return; }
      stage = 'board'; candidate = null; selected = null; draw();
    };
  }

  function bind() {
    app.querySelectorAll('[data-name]').forEach((b) => {
      b.onclick = () => { candidate = +b.dataset.name; stage = 'confirm'; draw(); window.scrollTo(0, 0); };
    });
    app.querySelector('#other')?.addEventListener('click', () => {
      me = null; store.set(meKey, null); stage = 'board'; draw(); window.scrollTo(0, 0);
    });
    app.querySelector('#cards')?.addEventListener('click', (e) => {
      const b = e.target.closest('.card');
      if (!b || b.disabled || busy) return;
      selected = +b.dataset.card;
      app.querySelectorAll('#cards .card').forEach((c) => {
        const on = +c.dataset.card === selected;
        c.classList.toggle('selected', on);
        c.setAttribute('aria-pressed', on);
      });
      updateBar();
    });
  }

  async function openCard(e) {
    if (busy || !selected) return;
    busy = true;
    e.target.disabled = true;
    e.target.textContent = 'Membuka…';
    try {
      v = await api.groupPick(publicId, candidate, selected);
      me = candidate;
      store.set(meKey, me);
      stage = 'board'; candidate = null; selected = null; justOpened = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      draw();
    } catch (ex) {
      toast(ex.message, 'warn');
      selected = null;
      v = await api.groupView(publicId).catch(() => v);
      if (person(candidate)?.card != null) { stage = 'board'; candidate = null; }
      draw();
    } finally {
      busy = false;
    }
  }

  async function load() {
    try {
      v = await api.groupView(publicId);
      if (me != null && !person(me)) { me = null; store.set(meKey, null); }
      draw();
    } catch (e) {
      app.innerHTML = `<section class="panel"><h1>Link tidak sah</h1><p class="lead">${esc(e.message)}</p></section>`;
      stop();
    }
  }

  const stop = poll(async () => {
    if (!v || v.status === 'done' || busy) return;
    const nv = await api.groupView(publicId);
    if (JSON.stringify(nv) === JSON.stringify(v)) return;
    const before = new Set(picked().map((p) => p.idx));
    const finished = nv.status === 'done' && v.status !== 'done';
    v = nv;
    const fresh = picked().filter((p) => !before.has(p.idx));
    // Nama yang sedang disahkan sudah dicabut di telefon lain.
    if (candidate != null && person(candidate).card != null) {
      toast(`${person(candidate).name} dah cabut di telefon lain.`, 'warn');
      stage = 'board'; candidate = null; selected = null;
    }
    // Kad yang dipilih sudah diambil orang lain.
    if (selected != null && v.people.some((p) => p.card === selected)) {
      toast(`Kad ${selected} baru diambil orang. Pilih kad lain.`, 'warn');
      selected = null;
    }
    if (fresh.length && !finished) {
      const f = fresh[fresh.length - 1];
      if (stage === 'board') toast(`${f.name} dapat ${monthLabel(v.start_month, f.month)}`);
    }
    draw();
    if (finished) confetti();
  }, 3000);

  load();
  return () => { stop(); setActionBar(''); };
}
