import { shortCode, verify } from './fair.js';

export const MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const MON3 = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Tarikh bulan ke-k (1 = bulan pertama) sebagai {y, m} (m: 0-11). */
function monthAt(start, k) {
  const [y, m] = start.split('-').map(Number);
  const idx = m - 1 + k - 1;
  return { y: y + Math.floor(idx / 12), m: idx % 12 };
}
export function monthLabel(start, k) {
  const { y, m } = monthAt(start, k);
  return `${MONTHS[m]} ${y}`;
}

/** "28 Okt 2026, 2:44 petang" */
export function fmtDate(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  const part = h < 12 ? 'pagi' : h < 19 ? 'petang' : 'malam';
  const h12 = h % 12 || 12;
  return `${d.getDate()} ${MON3[d.getMonth()]} ${d.getFullYear()}, ${h12}:${String(d.getMinutes()).padStart(2, '0')} ${part}`;
}

export { shortCode };

export const siteUrl = () => location.origin + location.pathname;
export const participantLink = (token) => `${siteUrl()}#p=${token}`;
export const adminLink = (token) => `${siteUrl()}#a=${token}`;
export const groupLink = (publicId) => `${siteUrl()}#k=${publicId}`;
export const resultsLink = groupLink;
export const waHref = (text) => 'https://wa.me/?text=' + encodeURIComponent(text);

export function calendarHref(groupName, start, month) {
  const { y, m } = monthAt(start, month);
  const d1 = `${y}${String(m + 1).padStart(2, '0')}01`;
  const d2 = `${y}${String(m + 1).padStart(2, '0')}02`;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Giliran saya terima emas — ${groupName}`,
    dates: `${d1}/${d2}`,
    details: `Bulan ${month} kutu emas ${groupName}: giliran saya terima emas pada ${monthLabel(start, month)}.`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export const ICON = {
  bar: `<svg class="logo" viewBox="0 0 64 44" aria-hidden="true"><defs><linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3a8"/><stop offset=".45" stop-color="#d4ad5a"/><stop offset="1" stop-color="#8b6a2b"/></linearGradient><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3cf"/><stop offset="1" stop-color="#e2bf6c"/></linearGradient></defs><path d="M4 40 L14 8 H50 L60 40 Z" fill="url(#gb)"/><path d="M14 8 H50 L45 18 H19 Z" fill="url(#gt)" opacity=".9"/><path d="M19 18 H45 L52 36 H12 Z" fill="none" stroke="#7a5a22" stroke-opacity=".45" stroke-width="1.4"/><text x="32" y="31.5" text-anchor="middle" font-family="Georgia,serif" font-size="9" fill="#5e4415" fill-opacity=".85" letter-spacing=".5">999.9</text></svg>`,
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.1.1.3 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>',
  dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v11H5z"/></svg>',
};

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
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
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
    toast(ok ? label : 'Tidak dapat menyalin. Tekan lama untuk salin.', ok ? 'ok' : 'warn');
  }
}

/** Butang dua langkah untuk tindakan yang tidak boleh diundur. */
export function armButton(btn, armedLabel, fn) {
  const label = btn.innerHTML;
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) {
      clearTimeout(btn._t);
      delete btn.dataset.armed;
      btn.innerHTML = label;
      fn();
      return;
    }
    btn.dataset.armed = '1';
    btn.textContent = armedLabel;
    btn._t = setTimeout(() => {
      delete btn.dataset.armed;
      btn.innerHTML = label;
    }, 4000);
  });
}

/** reveal: isi muka depan disediakan tetapi kad masih tertutup (untuk animasi buka). */
export function cardHTML(card, { open = false, reveal = false, month, start, taken = false, selected = false } = {}) {
  const cls = ['card', open && 'open', taken && 'taken', selected && 'selected'].filter(Boolean).join(' ');
  const front = open || reveal
    ? `<span class="b">Bulan</span><span class="n">${month}</span><span class="m">${esc(monthLabel(start, month))}</span>`
    : '';
  const aria = open ? `Kad ${card}: Bulan ${month}` : taken ? `Kad ${card}, sudah diambil` : `Kad ${card}`;
  return `<button type="button" class="${cls}" data-card="${card}" ${taken || open || reveal ? 'disabled' : ''} aria-label="${aria}" aria-pressed="${selected}">
    <span class="flip">
      <span class="face back"><span class="diamond"><span>${card}</span></span><span class="k">${taken ? 'Diambil' : ''}</span></span>
      <span class="face front">${front}</span>
    </span></button>`;
}

export function resultsTable(results, start, highlightName) {
  return `<ol class="rlist">${results
    .map((r) => `<li class="${r.name === highlightName ? 'me' : ''}">
      <span class="rnum">${r.month}</span>
      <span class="rname">${esc(r.name)}${r.name === highlightName ? ' <span class="tag gold">Anda</span>' : ''}${r.by_admin ? ' <span class="tag">dicabut admin</span>' : ''}</span>
      <span class="rmon">${esc(monthLabel(start, r.month))}</span></li>`)
    .join('')}</ol>`;
}

export function resultsText(v) {
  return (
    `*${v.group_name}*\nKeputusan cabutan giliran kutu emas\n\n` +
    v.results.map((r) => `${r.month}. ${r.name} — ${monthLabel(v.start_month, r.month)}${r.by_admin ? ' *' : ''}`).join('\n') +
    (v.results.some((r) => r.by_admin) ? '\n\n* dicabut oleh admin bagi pihak peserta' : '') +
    `\n\n✅ Kod Kunci: ${shortCode(v.commit_hash)}\nLihat & sahkan keputusan: ${resultsLink(v.public_id)}`
  );
}

/** Lencana "kad dikunci" sebelum selesai. */
export function lockBadge(v) {
  return `<div class="trust">
    <span class="trust-ic">${ICON.lock}</span>
    <span><b>Kad sudah dikunci</b> pada ${esc(fmtDate(v.created_at))}. Tiada sesiapa, termasuk admin, boleh lihat atau tukar isi kad.
    <span class="code-line">Kod Kunci: <b class="code">${shortCode(v.commit_hash)}</b></span></span>
  </div>`;
}

/** Bekas untuk semakan automatik selepas selesai; isi dengan runFairCheck(). */
export const fairBox = () => `<div class="trust pending" id="fair"><span class="trust-ic">${ICON.lock}</span><span>Menyemak keadilan keputusan…</span></div>`;

export async function runFairCheck(root, v) {
  const box = root.querySelector('#fair');
  if (!box) return;
  try {
    const r = await verify(v.seed, v.names);
    const ok = r.hash === v.commit_hash && v.results.every((x) => r.months[x.card - 1] === x.month);
    box.className = 'trust ' + (ok ? 'ok' : 'bad');
    box.innerHTML = ok
      ? `<span class="trust-ic">${ICON.check}</span><span><b>Disahkan adil.</b> Keputusan ini sama seperti semasa kad dikunci pada ${esc(fmtDate(v.created_at))}. Kod Kunci <b class="code">${shortCode(v.commit_hash)}</b> sepadan.</span>`
      : `<span class="trust-ic">!</span><span><b>Keputusan tidak sepadan dengan Kod Kunci.</b> Sila hubungi admin.</span>`;
  } catch {
    box.className = 'trust';
    box.innerHTML = `<span class="trust-ic">${ICON.lock}</span><span>Telefon ini tidak dapat menyemak secara automatik. Kod Kunci: <b class="code">${shortCode(v.commit_hash)}</b></span>`;
  }
}

/** Butiran teknikal yang disorok, untuk sesiapa yang mahu semak sendiri. */
export function techDetails(v) {
  return `<details class="tech"><summary>Butiran untuk semakan lanjutan</summary>
    <div class="tech-body">
      <p>Sistem ini menyemak secara automatik. Bahagian ini hanya untuk sesiapa yang mahu mengesahkan sendiri di halaman <a href="#semak">Semakan lanjutan</a>.</p>
      <span class="lbl">Kod pengesahan penuh</span><div class="mono">${v.commit_hash}</div>
      ${v.seed ? `<span class="lbl">Kod benih</span><div class="mono">${v.seed}</div>` : ''}
    </div></details>`;
}

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.getElementById('confetti');
  const x = c.getContext('2d');
  c.width = innerWidth;
  c.height = innerHeight;
  const cols = ['#f3d993', '#d4ad5a', '#8b6a2b', '#fff3cf'];
  const p = Array.from({ length: 120 }, () => ({
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
    if (t - t0 < 3000) requestAnimationFrame(frame);
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

/** Bar tindakan melekat di bawah skrin (mudah alih). */
export function setActionBar(html) {
  let bar = document.getElementById('actionbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'actionbar';
    bar.className = 'actionbar';
    document.body.appendChild(bar);
  }
  bar.innerHTML = html || '';
  bar.hidden = !html;
  document.body.classList.toggle('has-bar', !!html);
  return bar;
}
