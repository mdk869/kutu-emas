// PWA: aplikasi untuk ADMIN sahaja.
// - Popup "Letak di skrin utama" keluar sendiri di halaman admin (bukan di halaman ahli #k= / #p=).
// - Android (Chrome/Samsung/Edge): satu tekan butang "Install" terus buka dialog install pelayar.
//   Pelayar tidak membenarkan dialog itu dibuka tanpa satu ketikan pengguna.
// - iPhone/iPad: Apple tiada dialog install, jadi popup memaparkan panduan langkah demi langkah.
// - Dibuka dari dalam WhatsApp/Facebook: popup minta buka dalam Safari/Chrome dulu.
import { store, copy, toast, esc } from './ui.js';

const SNOOZE_KEY = 'kutu-emas-popup-nanti';
const SESSION_FLAG = 'kutu-emas-popup-dah-papar';
let deferred = null;
let fallbackTimer = null;

const ua = navigator.userAgent;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIPad = () => /ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIOS = () => /iphone|ipod/i.test(ua) || isIPad();
const isAndroid = () => /android/i.test(ua);
const inAppBrowser = () => /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)|GSA\//i.test(ua);
const snoozed = () => (store.get(SNOOZE_KEY, 0) || 0) > Date.now();
const onAdminPage = () => document.body.dataset.view === 'admin';

const ICONS = {
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 7.5 6.5l1.4 1.4L11 5.8V15h2V5.8l2.1 2.1 1.4-1.4zM5 10v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10h-2v10H7V10z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V5zm6 3h2v3h3v2h-3v3h-2v-3H8v-2h3z"/></svg>',
  dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z"/></svg>',
};

/** Mod popup untuk peranti ini, atau null jika tiada apa yang boleh dibuat. */
function mode() {
  if (standalone()) return null;
  if (deferred) return 'android';
  if (isIOS()) return inAppBrowser() ? 'ios-inapp' : 'ios';
  if (isAndroid()) return inAppBrowser() ? 'android-inapp' : 'android-menu';
  return null; // komputer tanpa sokongan: tiada popup
}

function header() {
  return `<div class="sheet-head">
    <img class="sheet-icon" src="/icons/icon-192.png" alt="" width="56" height="56">
    <div><b>Kutu Emas</b><span>Cabutan giliran kutu emas</span></div>
  </div>`;
}

function bodyFor(m) {
  const perks = `<ul class="perks">
    <li>${ICONS.check}Buka terus dari skrin utama, macam app</li>
    <li>${ICONS.check}Senarai kutu anda sentiasa ada</li>
    <li>${ICONS.check}Tak perlu cari link dalam WhatsApp lagi</li>
  </ul>`;
  switch (m) {
    case 'android':
      return {
        title: 'Letak Kutu Emas di skrin utama',
        html: perks,
        actions: '<button class="btn gold wide" data-act="install" type="button">Install sekarang</button><button class="btn ghost wide" data-act="later" type="button">Nanti</button>',
      };
    case 'ios':
      return {
        title: 'Letak Kutu Emas di skrin utama',
        html: `<ol class="steps-ios">
          <li><span class="si">${ICONS.share}</span><div><b>Tekan butang Kongsi</b><small>${isIPad() ? 'Di bahagian atas kanan Safari.' : 'Di bar bawah Safari. Kalau tak nampak, tekan <span class="mini">' + ICONS.dots + '</span> dulu.'}</small></div></li>
          <li><span class="si">${ICONS.plus}</span><div><b>Pilih "Tambah ke Skrin Utama"</b><small>Atau "Add to Home Screen". Skrol ke bawah sedikit jika perlu.</small></div></li>
          <li><span class="si txt">Add</span><div><b>Tekan "Tambah" / "Add"</b><small>Ikon Kutu Emas akan muncul di skrin utama.</small></div></li>
        </ol>`,
        actions: '<button class="btn gold wide" data-act="later" type="button">Faham</button>',
        pointer: isIPad() ? 'up' : 'down',
      };
    case 'ios-inapp':
      return {
        title: 'Buka dalam Safari dulu',
        html: '<p class="hint">Halaman ini dibuka dari dalam WhatsApp. Untuk letak di skrin utama, buka dalam Safari: tekan ikon <b>kompas</b> atau <b>•••</b>, kemudian pilih <b>Buka dalam Safari</b>. Atau salin link dan paste dalam Safari.</p>',
        actions: '<button class="btn gold wide" data-act="copy" type="button">Salin link</button><button class="btn ghost wide" data-act="later" type="button">Nanti</button>',
      };
    case 'android-inapp':
      return {
        title: 'Buka dalam Chrome dulu',
        html: '<p class="hint">Halaman ini dibuka dari dalam WhatsApp. Tekan menu <b>⋮</b> di atas kanan, kemudian pilih <b>Buka dalam Chrome</b>. Popup install akan keluar di sana.</p>',
        actions: '<button class="btn gold wide" data-act="copy" type="button">Salin link</button><button class="btn ghost wide" data-act="later" type="button">Nanti</button>',
      };
    case 'android-menu':
      return {
        title: 'Letak Kutu Emas di skrin utama',
        html: `${perks}<p class="hint">Tekan menu <b>⋮</b> pelayar anda, kemudian pilih <b>Install app</b> atau <b>Tambah ke skrin utama</b>.</p>`,
        actions: '<button class="btn gold wide" data-act="later" type="button">Faham</button>',
      };
    default:
      return null;
  }
}

function closeSheet() {
  document.querySelector('.sheet-backdrop')?.remove();
  document.removeEventListener('keydown', onKey);
}
function onKey(e) { if (e.key === 'Escape') { snooze(); closeSheet(); } }
function snooze() { store.set(SNOOZE_KEY, Date.now() + 3 * 24 * 3600 * 1000); }

/** Buka popup. Dipanggil secara automatik, atau bila admin tekan butang "Letak di skrin utama". */
export function openInstallSheet() {
  const m = mode();
  const b = m && bodyFor(m);
  if (!b) return false;
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="sheet${b.pointer === 'down' ? ' has-pointer' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" tabindex="-1">
      <span class="sheet-grip" aria-hidden="true"></span>
      ${header()}
      <h2 id="sheetTitle">${esc(b.title)}</h2>
      ${b.html}
      <div class="sheet-actions">${b.actions}</div>
    </div>
    ${b.pointer ? `<div class="sheet-pointer ${b.pointer}" aria-hidden="true">${b.pointer === 'up' ? '↑' : '↓'}</div>` : ''}`;
  document.body.appendChild(wrap);
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) { snooze(); closeSheet(); } });
  wrap.querySelector('[data-act="later"]')?.addEventListener('click', () => { snooze(); closeSheet(); });
  wrap.querySelector('[data-act="copy"]')?.addEventListener('click', () => copy(location.origin + '/', 'Link disalin.'));
  wrap.querySelector('[data-act="install"]')?.addEventListener('click', async () => {
    const e = deferred;
    if (!e) { closeSheet(); return; }
    deferred = null;
    closeSheet();
    e.prompt(); // dialog install pelayar (satu ketikan pengguna diperlukan, dan ini ketikan itu)
    const choice = await e.userChoice.catch(() => null);
    if (choice?.outcome !== 'accepted') snooze();
    refreshCards();
  });
  wrap.querySelector('.sheet')?.focus({ preventScroll: true });
  return true;
}

/** Papar popup secara automatik sekali bagi setiap lawatan, di halaman admin sahaja. */
function maybeAutoOpen() {
  if (!onAdminPage() || standalone() || snoozed()) return;
  try { if (sessionStorage.getItem(SESSION_FLAG)) return; } catch { /* storan disekat */ }
  if (document.querySelector('.sheet-backdrop')) return;
  if (openInstallSheet()) {
    try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch { /* storan disekat */ }
  }
}

function refreshCards() {
  document.querySelectorAll('[data-install-slot]').forEach((el) => installCard(el));
}

export function initPwa() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // guna popup kita sendiri, dan jangan papar apa-apa di halaman ahli
    deferred = e;
    clearTimeout(fallbackTimer);
    refreshCards();
    setTimeout(maybeAutoOpen, 1200);
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    closeSheet();
    refreshCards();
    toast('Kutu Emas dah ada di skrin utama.');
  });
  // iPhone / pelayar tanpa beforeinstallprompt: buka popup panduan selepas sedikit masa.
  fallbackTimer = setTimeout(() => { if (!deferred) maybeAutoOpen(); }, isIOS() ? 1500 : 4000);
  // Bila admin beralih ke halaman admin dari halaman lain (hash berubah).
  addEventListener('hashchange', () => setTimeout(() => { if (deferred || isIOS()) maybeAutoOpen(); }, 800));

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  // Jalur "tiada internet" yang kemas.
  const banner = document.createElement('div');
  banner.className = 'offline';
  banner.setAttribute('role', 'status');
  banner.textContent = 'Tiada internet. Halaman akan dikemas kini bila talian pulih.';
  banner.hidden = navigator.onLine;
  document.body.appendChild(banner);
  addEventListener('online', () => { banner.hidden = true; });
  addEventListener('offline', () => { banner.hidden = false; });
}

/** Butang kecil "Letak di skrin utama" di halaman admin, untuk buka semula popup bila-bila masa. */
export function installCard(box) {
  if (!box) return;
  box.dataset.installSlot = '1';
  if (!onAdminPage() || !mode()) { box.innerHTML = ''; return; }
  box.innerHTML = `<button class="install-chip" type="button"><img src="/icons/icon-192.png" alt="" width="28" height="28"><span>Letak Kutu Emas di skrin utama</span><span class="chev" aria-hidden="true">›</span></button>`;
  box.querySelector('button').onclick = () => openInstallSheet();
}
