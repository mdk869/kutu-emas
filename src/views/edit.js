import { api } from '../api.js';
import { esc, toast, setActionBar, shortCode, armButton } from '../ui.js';
import { normName } from '../fair.js';
import { rememberSession, forgetSession } from './home.js';

/**
 * Edit kutu (#edit=<token>).
 * - Nama group: boleh diubah bila-bila masa.
 * - Nama ahli & bulan mula: hanya sebelum ada ahli yang cabut. Ubah nama ahli = kad disusun semula
 *   dan Kod Kunci baru (link group kekal sama).
 * - Padam terus: hanya sebelum ada ahli yang cabut.
 */
export function renderEdit(app, token) {
  let v = null;
  app.innerHTML = `<div class="panel"><p class="muted">Sedang buka…</p></div>`;

  const ym = (d) => d.slice(0, 7);

  function draw() {
    const picked = v.participants.filter((p) => p.card != null).length;
    const locked = picked > 0;
    app.innerHTML = `
    <a class="back-link" href="#a=${esc(token)}">‹ Kembali</a>
    <section class="panel">
      <div>
        <div class="eyebrow">Edit kutu</div>
        <h1>${esc(v.group_name)}</h1>
      </div>
      ${locked ? `<div class="trust"><span class="trust-ic">!</span><span><b>${picked} ahli dah cabut.</b> Untuk jaga keadilan, nama ahli dan bulan mula tak boleh diubah lagi. Anda masih boleh tukar nama group.</span></div>` : ''}
      <form id="ef" class="stack" novalidate>
        <div class="field">
          <label for="eGroup">Nama group kutu</label>
          <input id="eGroup" maxlength="80" value="${esc(v.group_name)}" autocomplete="off">
        </div>
        <div class="field">
          <label for="eStart">Kutu mula bulan</label>
          <input id="eStart" type="month" value="${ym(v.start_month)}" ${locked ? 'disabled' : ''}>
        </div>
        <div class="field">
          <label for="eNames">Nama ahli</label>
          <span class="hint">Satu nama satu baris.</span>
          <textarea id="eNames" rows="8" ${locked ? 'disabled' : ''}>${esc(v.names.join('\n'))}</textarea>
          <ol class="chips" id="eChips" aria-label="Senarai ahli"></ol>
        </div>
        <div class="trust warnbox" id="relockNote" hidden><span class="trust-ic">!</span><span>Nama ahli berubah. Bila disimpan, <b>kad akan disusun semula</b> dan <b>Kod Kunci baru</b> akan dijana. Link group kekal sama, tapi umumkan Kod Kunci baru dalam group.</span></div>
        <p class="err" id="eErr" role="alert"></p>
      </form>
    </section>

    <section class="panel quiet danger">
      <h2>Padam kutu ini</h2>
      ${locked
        ? '<p class="hint">Kutu ini tak boleh dipadam kerana dah ada ahli yang cabut. Anda masih boleh buang kutu ini dari senarai di telefon anda.</p><button class="btn small" id="forget" type="button">Buang dari senarai</button>'
        : '<p class="hint">Kutu dan link cabutan akan dipadam terus. Ahli yang buka link akan nampak "link tidak sah". Tindakan ini tak boleh dibatalkan.</p><button class="btn small danger-btn" id="del" type="button">Padam terus</button>'}
    </section>`;

    const $ = (s) => app.querySelector(s);
    const bar = setActionBar('<button class="btn gold wide" id="save" type="button">Simpan</button>');
    const parse = () => $('#eNames').value.split('\n').map(normName).filter(Boolean);
    const namesChanged = () => !locked && parse().join('\n') !== v.names.join('\n');
    const chips = () => {
      const names = parse();
      $('#eChips').innerHTML = names.map((n) => `<li>${esc(n)}</li>`).join('');
      $('#relockNote').hidden = !namesChanged();
    };
    chips();
    $('#eNames').addEventListener('input', chips);

    let armed = false;
    bar.querySelector('#save').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const err = $('#eErr');
      err.textContent = '';
      const group = normName($('#eGroup').value);
      if (!group) { err.textContent = 'Nama group tak boleh kosong.'; return; }
      const changeNames = namesChanged();
      const names = changeNames ? parse() : null;
      if (changeNames && names.length < 2) { err.textContent = 'Masukkan sekurang-kurangnya 2 nama.'; return; }
      const start = locked ? null : `${$('#eStart').value}-01`;
      if (changeNames && !armed) {
        armed = true;
        btn.textContent = 'Tekan lagi untuk simpan & susun semula kad';
        btn.dataset.armed = '1';
        setTimeout(() => { armed = false; btn.textContent = 'Simpan'; delete btn.dataset.armed; }, 5000);
        return;
      }
      btn.disabled = true; btn.textContent = 'Menyimpan…';
      try {
        const nv = await api.adminUpdate(token, { group, start, names });
        rememberSession({ token, group: nv.group_name, n: nv.n, at: nv.created_at });
        toast(nv.commit_hash !== v.commit_hash ? `Disimpan. Kod Kunci baru: ${shortCode(nv.commit_hash)}` : 'Disimpan.');
        location.hash = `a=${token}`;
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false; btn.textContent = 'Simpan'; armed = false;
      }
    });

    const del = $('#del');
    if (del) {
      armButton(del, 'Tekan sekali lagi untuk padam terus', async () => {
        del.disabled = true;
        try {
          await api.adminDelete(token);
          forgetSession(token);
          toast('Kutu dipadam.');
          location.hash = '';
        } catch (ex) { toast(ex.message, 'warn'); del.disabled = false; }
      });
    }
    const forget = $('#forget');
    if (forget) {
      armButton(forget, 'Tekan lagi untuk buang', () => {
        forgetSession(token);
        toast('Dibuang dari senarai.');
        location.hash = '';
      });
    }
  }

  api.adminView(token)
    .then((r) => { v = r; draw(); })
    .catch((e) => {
      setActionBar('');
      app.innerHTML = `<section class="panel"><h1>Kutu tidak dijumpai</h1><p class="lead">${esc(e.message)}</p>
        <button class="btn" id="forget" type="button">Buang dari senarai</button></section>`;
      app.querySelector('#forget').onclick = () => { forgetSession(token); location.hash = ''; };
    });

  return () => {};
}
