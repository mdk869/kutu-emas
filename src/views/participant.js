import { api } from '../api.js';
import { esc, groupHash, monthLabel, cardHTML, resultsTable, toast, poll, confetti } from '../ui.js';
import { verify } from '../fair.js';

export function renderParticipant(app, token) {
  let v = null;
  let selected = null;
  let busy = false;
  let justOpened = false;
  app.innerHTML = `<div class="panel"><p class="muted">Memuatkan kad…</p></div>`;

  async function load() {
    try {
      v = await api.participantView(token);
      draw();
    } catch (e) {
      app.innerHTML = `<section class="panel"><h1>Pautan tidak sah</h1><p class="err">${esc(e.message)}</p></section>`;
      stop();
    }
  }

  function drawPick() {
    const taken = new Set(v.taken);
    const cards = Array.from({ length: v.n }, (_, i) => i + 1)
      .map((c) => cardHTML(c, { taken: taken.has(c), selected: selected === c }))
      .join('');
    return `
    <section class="panel stage">
      <div class="banner">
        <div><div class="sub">Giliran anda</div><div class="who">Pilih satu kad</div></div>
        <div class="progress">${v.taken.length} / ${v.n} diambil</div>
      </div>
      <div class="cards" id="cards">${cards}</div>
      <div class="confirm" ${selected ? '' : 'hidden'}>
        <p>Anda pilih <b>Kad ${selected ?? ''}</b>. Pilihan ini muktamad dan tidak boleh ditukar.</p>
        <div class="row">
          <button class="btn gold" id="openBtn" type="button">Buka Kad ${selected ?? ''}</button>
          <button class="btn" id="cancelBtn" type="button">Tukar kad</button>
        </div>
      </div>
      <p class="hint">Isi setiap kad sudah ditetapkan dan disimpan di server sebelum sesiapa memilih. Kad mana pun yang anda pilih, peluangnya sama.</p>
    </section>`;
  }

  function drawMine() {
    const m = v.me;
    return `
    <section class="panel mine">
      <div class="mine-card">${cardHTML(m.card, { open: !justOpened, reveal: true, month: m.month, start: v.start_month })}</div>
      <div class="mine-text">
        <div class="eyebrow">Giliran anda</div>
        <div class="big">Bulan ${m.month}</div>
        <p class="lead">Anda terima emas pada <b>${esc(monthLabel(v.start_month, m.month))}</b>.</p>
        ${m.by_admin ? '<p class="hint">Kad ini dicabut secara rawak oleh admin bagi pihak anda.</p>' : ''}
        ${v.status === 'done' ? '' : `<p class="muted">Keputusan penuh akan dibuka bila semua peserta selesai (${v.taken.length}/${v.n}).</p>`}
      </div>
    </section>`;
  }

  function drawPeople() {
    return `
    <section class="panel">
      <h2>Status peserta</h2>
      <ul class="people">${v.people.map((p) => `<li class="${p.picked ? 'yes' : ''}"><span class="dot" aria-hidden="true"></span>${esc(p.name)}<span class="sr">${p.picked ? ' sudah cabut' : ' belum cabut'}</span></li>`).join('')}</ul>
    </section>`;
  }

  function drawDone() {
    return `
    <section class="panel">
      <h2>Keputusan penuh</h2>
      ${resultsTable(v.results, v.start_month)}
      <div class="verify-auto" id="vauto"><span class="muted">Menyemak keputusan…</span></div>
      <details class="seal-details"><summary>Kod benih &amp; cara semak</summary>
        <div class="seal"><span class="lbl">Kod benih</span><div class="mono">${v.seed}</div>
        <p>Tampal kod benih dan senarai nama di halaman <a href="#semak">Semak keputusan</a>. Hasilnya mesti sama dengan kod pengesahan dan keputusan di atas.</p></div>
      </details>
    </section>`;
  }

  function draw() {
    const picked = v.me.card != null;
    app.innerHTML = `
    <section class="panel hero-panel">
      <div class="eyebrow">${esc(v.group_name)}</div>
      <h1>Hai, ${esc(v.me.name)}</h1>
      <div class="seal compact"><span class="lbl">Kod pengesahan</span><div class="mono">${groupHash(v.commit_hash)}</div>
      <p>Pastikan kod ini sama dengan yang admin umumkan dalam group.</p></div>
    </section>
    ${picked ? drawMine() : drawPick()}
    ${v.status === 'done' ? drawDone() : drawPeople()}`;

    if (picked && justOpened) {
      justOpened = false;
      requestAnimationFrame(() => requestAnimationFrame(() => app.querySelector('.mine-card .card')?.classList.add('open')));
      confetti();
    }
    if (!picked) bindPick();
    if (v.status === 'done') autoVerify();
  }

  function bindPick() {
    app.querySelector('#cards').addEventListener('click', (e) => {
      const b = e.target.closest('.card');
      if (!b || b.disabled || busy) return;
      selected = +b.dataset.card;
      draw();
      app.querySelector('.confirm')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    app.querySelector('#cancelBtn')?.addEventListener('click', () => { selected = null; draw(); });
    app.querySelector('#openBtn')?.addEventListener('click', async (e) => {
      if (busy) return;
      busy = true;
      e.target.disabled = true;
      e.target.textContent = 'Membuka…';
      try {
        v = await api.pick(token, selected);
        justOpened = true;
        selected = null;
        draw();
      } catch (ex) {
        toast(ex.message, 'warn');
        selected = null;
        v = await api.participantView(token).catch(() => v);
        draw();
      } finally {
        busy = false;
      }
    });
  }

  async function autoVerify() {
    const box = app.querySelector('#vauto');
    try {
      const r = await verify(v.seed, v.names);
      const ok = r.hash === v.commit_hash && v.results.every((x) => r.months[x.card - 1] === x.month);
      box.innerHTML = ok
        ? '<span class="ok">✓ Disemak dalam telefon anda: keputusan sepadan dengan kod pengesahan. Tiada perubahan selepas dikunci.</span>'
        : '<span class="bad">Keputusan tidak sepadan dengan kod pengesahan. Hubungi admin.</span>';
    } catch {
      box.innerHTML = '<span class="muted">Pelayar ini tidak dapat menyemak secara automatik. Guna halaman Semak keputusan.</span>';
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
  return stop;
}
