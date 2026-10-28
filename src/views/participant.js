import { api } from '../api.js';
import {
  esc, monthLabel, cardHTML, resultsTable, toast, poll, confetti, lockBadge, fairBox, runFairCheck,
  techDetails, calendarHref, setActionBar, ICON,
} from '../ui.js';

export function renderParticipant(app, token) {
  let v = null;
  let selected = null;
  let busy = false;
  let justOpened = false;
  app.innerHTML = `<div class="panel"><p class="muted">Sedang buka…</p></div>`;

  async function load() {
    try {
      v = await api.participantView(token);
      draw();
    } catch (e) {
      app.innerHTML = `<section class="panel"><h1>Link tidak sah</h1><p class="lead">${esc(e.message)}</p></section>`;
      stop();
    }
  }

  function firstName(n) { return n.split(' ')[0]; }

  function drawPick() {
    const taken = new Set(v.taken);
    const left = v.n - v.taken.length;
    return `
    <section class="panel hero-panel">
      <div class="eyebrow">${esc(v.group_name)}</div>
      <h1>Hai ${esc(firstName(v.me.name))}, pilih satu kad</h1>
      <p class="lead">Semua kad ada peluang yang sama. Bulan giliran anda akan keluar sebaik kad dibuka.</p>
    </section>
    <section class="panel stage">
      <div class="cards" id="cards">${Array.from({ length: v.n }, (_, i) => i + 1)
        .map((c) => cardHTML(c, { taken: taken.has(c), selected: selected === c })).join('')}</div>
      <p class="hint center">${left} kad lagi boleh dipilih. Kad gelap sudah diambil orang lain.</p>
    </section>
    <section class="panel quiet">${lockBadge(v)}</section>`;
  }

  function drawMine() {
    const m = v.me;
    const done = v.status === 'done';
    const picked = v.taken.length;
    return `
    <section class="panel mine">
      <div class="eyebrow">${esc(v.group_name)}</div>
      <div class="mine-card">${cardHTML(m.card, { open: !justOpened, reveal: true, month: m.month, start: v.start_month })}</div>
      <p class="mine-lead">${esc(firstName(m.name))}, giliran anda terima emas pada:</p>
      <div class="big">${esc(monthLabel(v.start_month, m.month))}</div>
      <p class="muted">Giliran ke-${m.month} daripada ${v.n}${m.by_admin ? ' · dicabut oleh admin bagi pihak anda' : ''}</p>
      <a class="btn wide" href="${calendarHref(v.group_name, v.start_month, m.month)}" target="_blank" rel="noopener">${ICON.cal} Simpan dalam kalendar</a>
    </section>
    ${done ? '' : `
    <section class="panel">
      <h2>Tunggu ahli lain</h2>
      <div class="progress-wrap">
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${v.n}" aria-valuenow="${picked}"><span style="width:${(picked / v.n) * 100}%"></span></div>
        <span class="progress">${picked}/${v.n}</span>
      </div>
      <p class="hint">Senarai penuh akan keluar di sini bila semua dah cabut. Anda boleh tutup dulu dan buka link yang sama nanti.</p>
      <ul class="people">${v.people.map((p) => `<li class="${p.picked ? 'yes' : ''}">${p.picked ? ICON.check : '<span class="dot"></span>'}${esc(p.name)}<span class="sr">${p.picked ? ' sudah cabut' : ' belum cabut'}</span></li>`).join('')}</ul>
    </section>
    <section class="panel quiet">${lockBadge(v)}</section>`}`;
  }

  function drawDone() {
    return `
    <section class="panel">
      <h2>Giliran terima emas</h2>
      ${resultsTable(v.results, v.start_month, v.me.name)}
      ${fairBox()}
      ${techDetails(v)}
    </section>`;
  }

  function updateBar() {
    if (v.me.card != null || v.status === 'done') { setActionBar(''); return; }
    const bar = setActionBar(selected
      ? `<div class="bar-row"><button class="btn" id="cancelBtn" type="button">Batal</button><button class="btn gold grow" id="openBtn" type="button">Buka Kad ${selected}</button></div>
         <p class="bar-note">Lepas buka, tak boleh tukar.</p>`
      : `<p class="bar-hint">Tekan satu kad untuk pilih</p>`);
    bar.querySelector('#cancelBtn')?.addEventListener('click', () => { selected = null; draw(); });
    bar.querySelector('#openBtn')?.addEventListener('click', openCard);
  }

  function draw() {
    const picked = v.me.card != null;
    app.innerHTML = (picked ? drawMine() : drawPick()) + (v.status === 'done' ? drawDone() : '');
    updateBar();

    if (picked && justOpened) {
      justOpened = false;
      setTimeout(() => app.querySelector('.mine-card .card')?.classList.add('open'), 120);
      setTimeout(confetti, 700);
    }
    if (!picked) {
      app.querySelector('#cards').addEventListener('click', (e) => {
        const b = e.target.closest('.card');
        if (!b || b.disabled || busy) return;
        selected = +b.dataset.card;
        app.querySelectorAll('.card').forEach((c) => {
          const on = +c.dataset.card === selected;
          c.classList.toggle('selected', on);
          c.setAttribute('aria-pressed', on);
        });
        updateBar();
      });
    }
    if (v.status === 'done') runFairCheck(app, v);
  }

  async function openCard(e) {
    if (busy || !selected) return;
    busy = true;
    e.target.disabled = true;
    e.target.textContent = 'Membuka…';
    try {
      v = await api.pick(token, selected);
      justOpened = true;
      selected = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      draw();
    } catch (ex) {
      toast(ex.message, 'warn');
      selected = null;
      v = await api.participantView(token).catch(() => v);
      draw();
    } finally {
      busy = false;
    }
  }

  const stop = poll(async () => {
    if (!v || v.status === 'done' || busy || selected) return;
    const nv = await api.participantView(token);
    if (JSON.stringify(nv) !== JSON.stringify(v)) {
      const finished = nv.status === 'done' && v.status !== 'done';
      v = nv;
      draw();
      if (finished) confetti();
    }
  });
  load();
  return () => { stop(); setActionBar(''); };
}
