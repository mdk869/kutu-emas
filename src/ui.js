export const MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** start: 'YYYY-MM-DD', k: bulan ke-k (1 = bulan pertama) */
export function monthLabel(start, k) {
  const [y, m] = start.split('-').map(Number);
  const idx = m - 1 + k - 1;
  return `${MONTHS[idx % 12]} ${y + Math.floor(idx / 12)}`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

export const groupHash = (h) => (h || '').match(/.{1,4}/g)?.join(' ') ?? '';

export const siteUrl = () => location.origin + location.pathname;
export const participantLink = (token) => `${siteUrl()}#p=${token}`;
export const adminLink = (token) => `${siteUrl()}#a=${token}`;
export const waHref = (text) => 'https://wa.me/?text=' + encodeURIComponent(text);

export function toast(msg, kind = 'ok') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.className = 'toast show ' + kind;
  el.textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

export async function copy(text, label = 'Disalin.') {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand?.('copy');
    ta.remove();
    toast(ok ? label : 'Tidak dapat menyalin. Salin secara manual.', ok ? 'ok' : 'warn');
  }
}

/** Butang dua langkah untuk tindakan yang tidak boleh diundur. */
export function armButton(btn, armedLabel, fn) {
  const label = btn.textContent;
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) {
      clearTimeout(btn._t);
      delete btn.dataset.armed;
      btn.textContent = label;
      fn();
      return;
    }
    btn.dataset.armed = '1';
    btn.textContent = armedLabel;
    btn._t = setTimeout(() => {
      delete btn.dataset.armed;
      btn.textContent = label;
    }, 4000);
  });
}

/** reveal: isi muka depan disediakan tetapi kad masih tertutup (untuk animasi buka). */
export function cardHTML(card, { open = false, reveal = false, month, start, name, taken = false, selected = false, disabled = false } = {}) {
  const cls = ['card', open && 'open', taken && 'taken', selected && 'selected'].filter(Boolean).join(' ');
  if (reveal) disabled = true;
  const front = open || reveal
    ? `<span class="b">Bulan</span><span class="n">${month}</span><span class="m">${esc(monthLabel(start, month))}</span>${name ? `<span class="p">${esc(name)}</span>` : ''}`
    : '';
  const aria = open ? `Kad ${card}: Bulan ${month}` : taken ? `Kad ${card}, sudah diambil` : `Kad ${card}`;
  return `<button type="button" class="${cls}" data-card="${card}" ${disabled || taken || open ? 'disabled' : ''} aria-label="${aria}">
    <span class="flip">
      <span class="face back"><span class="diamond"><span>${card}</span></span><span class="k">${taken ? 'Diambil' : 'Kutu Emas'}</span></span>
      <span class="face front">${front}</span>
    </span></button>`;
}

export function resultsTable(results, start) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Bulan</th><th>Nama</th><th>Terima pada</th></tr></thead>
    <tbody>${results
      .map((r) => `<tr><td class="bul">${r.month}</td><td>${esc(r.name)}${r.by_admin ? ' <span class="tag">dicabut admin</span>' : ''}</td><td class="mon">${esc(monthLabel(start, r.month))}</td></tr>`)
      .join('')}</tbody></table></div>`;
}

export function resultsText(v) {
  return (
    `*${v.group_name}* — Keputusan cabutan giliran kutu emas\n\n` +
    v.results.map((r) => `Bulan ${r.month} (${monthLabel(v.start_month, r.month)}): ${r.name}${r.by_admin ? ' *' : ''}`).join('\n') +
    (v.results.some((r) => r.by_admin) ? '\n\n* dicabut oleh admin bagi pihak peserta' : '') +
    `\n\nKod pengesahan:\n${v.commit_hash}\nKod benih:\n${v.seed}\n\nSemak sendiri: ${siteUrl()}#semak`
  );
}

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.getElementById('confetti');
  const x = c.getContext('2d');
  c.width = innerWidth;
  c.height = innerHeight;
  const cols = ['#f3d993', '#d4ad5a', '#8b6a2b', '#fff3cf'];
  const p = Array.from({ length: 140 }, () => ({
    x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, r: 3 + Math.random() * 5,
    vy: 2 + Math.random() * 3, vx: -1 + Math.random() * 2, a: Math.random() * 6, va: -0.1 + Math.random() * 0.2,
    c: cols[(Math.random() * 4) | 0],
  }));
  const t0 = performance.now();
  (function frame(t) {
    x.clearRect(0, 0, c.width, c.height);
    for (const q of p) {
      q.x += q.vx; q.y += q.vy; q.a += q.va;
      x.save(); x.translate(q.x, q.y); x.rotate(q.a); x.fillStyle = q.c; x.fillRect(-q.r, -q.r / 2, q.r * 2, q.r); x.restore();
    }
    if (t - t0 < 3200) requestAnimationFrame(frame);
    else x.clearRect(0, 0, c.width, c.height);
  })(t0);
}

/** Polling ringkas yang berhenti bila tab disembunyikan. */
export function poll(fn, ms = 5000) {
  let timer = null;
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    if (!document.hidden) await fn().catch(() => {});
    timer = setTimeout(tick, ms);
  };
  const onVis = () => { if (!document.hidden && !stopped) { clearTimeout(timer); tick(); } };
  document.addEventListener('visibilitychange', onVis);
  timer = setTimeout(tick, ms);
  return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
}

export const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storan disekat */ }
  },
};
