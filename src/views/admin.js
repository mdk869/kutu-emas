import { api } from '../api.js';
import {
  esc, groupHash, monthLabel, fmtDate, participantLink, adminLink, waHref, copy, toast,
  armButton, resultsTable, resultsText, poll, confetti,
} from '../ui.js';

export function renderAdmin(app, token) {
  let v = null;
  let wasDone = null;
  app.innerHTML = `<div class="panel"><p class="muted">Memuatkan sesi…</p></div>`;

  async function load() {
    try {
      v = await api.adminView(token);
      draw();
    } catch (e) {
      app.innerHTML = `<section class="panel"><h1>Sesi tidak dijumpai</h1><p class="err">${esc(e.message)}</p><a class="btn" href="#">Cipta cabutan baru</a></section>`;
      stop();
    }
  }

  function announceText() {
    return `*${v.group_name}* — Cabutan giliran kutu emas\n\nKod pengesahan (dijana sebelum sesiapa cabut):\n${v.commit_hash}\n\nSaya akan hantar pautan peribadi kepada setiap peserta. Pilih satu kad, dan anda terus tahu bulan anda. Keputusan penuh dibuka bila semua selesai.`;
  }
  function inviteText(p) {
    return `Assalamualaikum ${p.name}, ini pautan cabutan *${v.group_name}* untuk anda. Pautan ini khas untuk anda, jangan kongsi.\n\n${participantLink(p.token)}`;
  }

  function draw() {
    const done = v.status === 'done';
    const picked = v.participants.filter((p) => p.card != null).length;
    const pct = Math.round((picked / v.n) * 100);
    if (wasDone === false && done) confetti();
    wasDone = done;

    app.innerHTML = `
    <section class="panel hero-panel">
      <div class="row-between">
        <div>
          <div class="eyebrow">Papan pemuka admin</div>
          <h1>${esc(v.group_name)}</h1>
          <p class="muted">Bermula ${esc(monthLabel(v.start_month, 1))} · ${v.n} peserta · dicipta ${esc(fmtDate(v.created_at))}</p>
        </div>
        <span class="status ${done ? 'done' : 'open'}">${done ? 'Selesai' : 'Sedang berjalan'}</span>
      </div>
      <div class="progress-wrap" aria-label="${picked} daripada ${v.n} sudah cabut">
        <div class="bar"><span style="width:${pct}%"></span></div>
        <span class="progress">${picked} / ${v.n} sudah cabut</span>
      </div>
    </section>

    ${done ? `
    <section class="panel">
      <div class="row-between"><h2>Keputusan giliran</h2><span class="count">${esc(fmtDate(v.completed_at))}</span></div>
      ${resultsTable(v.results, v.start_month)}
      <div class="row">
        <a class="btn wa" href="${waHref(resultsText(v))}" target="_blank" rel="noopener">Kongsi keputusan ke WhatsApp</a>
        <button class="btn" id="copyRes" type="button">Salin teks keputusan</button>
      </div>
    </section>` : ''}

    <div class="cols admin-cols">
      <section class="panel">
        <div class="row-between"><h2>Peserta</h2>${done ? '' : '<span class="count">Dikemas kini setiap 5 saat</span>'}</div>
        <ul class="plist">
          ${v.participants.map((p) => `
          <li>
            <span class="no">${p.idx}</span>
            <span class="pname">${esc(p.name)}
              <small>${p.card != null
                ? `Kad ${p.card} · ${esc(fmtDate(p.picked_at))}${p.by_admin ? ' · dicabut admin' : ''}`
                : 'Belum cabut'}</small>
            </span>
            ${p.card != null
              ? `<span class="pill got">Bulan ${p.month}</span>`
              : `<span class="pacts">
                  <a class="btn small wa" href="${waHref(inviteText(p))}" target="_blank" rel="noopener" aria-label="Hantar pautan kepada ${esc(p.name)} melalui WhatsApp">WhatsApp</a>
                  <button class="btn small" type="button" data-copy="${p.idx}">Salin pautan</button>
                  <button class="btn small ghost" type="button" data-pick="${p.idx}">Cabut bagi pihaknya</button>
                </span>`}
          </li>`).join('')}
        </ul>
        ${done ? '' : '<p class="hint">"Cabut bagi pihaknya" memilih kad baki secara rawak oleh server, bukan dipilih oleh admin. Ia direkod dalam keputusan.</p>'}
      </section>

      <aside class="stack">
        <section class="panel">
          <h2>Kod pengesahan</h2>
          <div class="seal">
            <div class="mono">${groupHash(v.commit_hash)}</div>
            ${done
              ? `<span class="lbl">Kod benih (sudah didedahkan)</span><div class="mono">${v.seed}</div>`
              : `<p>Umumkan kod ini dalam group <b>sebelum</b> hantar pautan. Ia membuktikan isi kad sudah ditetapkan dan tidak boleh diubah.</p>`}
          </div>
          ${done ? '' : `<a class="btn wa" href="${waHref(announceText())}" target="_blank" rel="noopener">Umumkan kod dalam group</a>`}
        </section>
        <section class="panel">
          <h2>Pautan admin anda</h2>
          <p class="hint">Simpan pautan ini. Sesiapa yang ada pautan ini boleh mengurus sesi. Jangan kongsi dalam group.</p>
          <button class="btn small" id="copyAdmin" type="button">Salin pautan admin</button>
        </section>
      </aside>
    </div>`;

    const $ = (s) => app.querySelector(s);
    $('#copyAdmin').onclick = () => copy(adminLink(token), 'Pautan admin disalin.');
    if (done) $('#copyRes').onclick = () => copy(resultsText(v), 'Teks keputusan disalin.');
    app.querySelectorAll('[data-copy]').forEach((b) => {
      const p = v.participants.find((x) => x.idx === +b.dataset.copy);
      b.onclick = () => copy(participantLink(p.token), `Pautan ${p.name} disalin.`);
    });
    app.querySelectorAll('[data-pick]').forEach((b) => {
      const idx = +b.dataset.pick;
      armButton(b, 'Tekan lagi untuk sahkan', async () => {
        b.disabled = true;
        try {
          v = await api.adminPick(token, idx);
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

  // Lukis semula hanya bila data berubah, supaya butang yang sedang "disahkan" tidak hilang.
  const stop = poll(async () => {
    if (!v || v.status === 'done') return;
    const nv = await api.adminView(token);
    if (JSON.stringify(nv) !== JSON.stringify(v)) { v = nv; draw(); }
  });
  load();
  return stop;
}
