import { api } from '../api.js';
import { esc, monthLabel, resultsTable, poll, fairBox, runFairCheck, techDetails, lockBadge } from '../ui.js';

/** Halaman keputusan awam (#k=…) yang dikongsi dalam group WhatsApp. */
export function renderResults(app, publicId) {
  let v = null;
  app.innerHTML = `<div class="panel"><p class="muted">Memuatkan keputusan…</p></div>`;

  function draw() {
    const done = v.status === 'done';
    app.innerHTML = `
    <section class="panel hero-panel">
      <div class="eyebrow">Keputusan cabutan</div>
      <h1>${esc(v.group_name)}</h1>
      <p class="muted">${v.n} peserta · bermula ${esc(monthLabel(v.start_month, 1))}</p>
    </section>
    ${done ? `
    <section class="panel">
      <h2>Senarai giliran</h2>
      ${resultsTable(v.results, v.start_month)}
      ${fairBox()}
      ${techDetails(v)}
    </section>` : `
    <section class="panel">
      <h2>Cabutan masih berjalan</h2>
      <div class="progress-wrap">
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${v.n}" aria-valuenow="${v.picked}"><span style="width:${(v.picked / v.n) * 100}%"></span></div>
        <span class="progress">${v.picked}/${v.n}</span>
      </div>
      <p class="hint">Senarai giliran akan dipaparkan di sini sebaik sahaja semua peserta selesai cabut. Halaman ini dikemas kini sendiri.</p>
    </section>
    <section class="panel quiet">${lockBadge(v)}</section>`}`;
    if (done) runFairCheck(app, v);
  }

  async function load() {
    try {
      v = await api.resultsView(publicId);
      draw();
    } catch (e) {
      app.innerHTML = `<section class="panel"><h1>Keputusan tidak dijumpai</h1><p class="lead">${esc(e.message)}</p></section>`;
      stop();
    }
  }

  const stop = poll(async () => {
    if (!v || v.status === 'done') return;
    const nv = await api.resultsView(publicId);
    if (JSON.stringify(nv) !== JSON.stringify(v)) { v = nv; draw(); }
  });
  load();
  return stop;
}
