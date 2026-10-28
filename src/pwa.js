// PWA: aplikasi untuk ADMIN sahaja.
// - Gesaan automatik Chrome disekat di semua halaman (preventDefault), dan butang "Pasang"
//   kita sendiri hanya dipaparkan di halaman admin. Peserta (#k=, #p=) tidak pernah nampak gesaan.
// - iPhone tiada gesaan automatik, jadi kita paparkan panduan "Add to Home Screen".
import { store, copy } from './ui.js';

const DISMISS_KEY = 'kutu-emas-pasang-nanti';
let deferred = null;

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inAppBrowser = () => /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)|GSA\//i.test(navigator.userAgent);
const dismissed = () => (store.get(DISMISS_KEY, 0) || 0) > Date.now();

function refreshCards() {
  document.querySelectorAll('[data-install-slot]').forEach((el) => installCard(el));
}

export function initPwa() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // jangan biar Chrome papar gesaan sendiri (cth. di halaman peserta)
    deferred = e;
    refreshCards();
  });
  addEventListener('appinstalled', () => { deferred = null; refreshCards(); });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  // Jalur "tiada internet" yang kemas.
  const banner = document.createElement('div');
  banner.className = 'offline';
  banner.setAttribute('role', 'status');
  banner.textContent = 'Tiada sambungan internet. Cabutan akan dikemas kini bila talian pulih.';
  banner.hidden = navigator.onLine;
  document.body.appendChild(banner);
  addEventListener('online', () => { banner.hidden = true; });
  addEventListener('offline', () => { banner.hidden = false; });
}

/** Kad "Pasang aplikasi" — panggil hanya dari halaman admin. */
export function installCard(box) {
  if (!box) return;
  box.dataset.installSlot = '1';
  if (document.body.dataset.view !== 'admin' || standalone() || dismissed()) { box.innerHTML = ''; return; }

  const later = '<button class="btn small ghost" data-later type="button">Nanti</button>';
  let html = '';
  if (deferred) {
    html = `<p><b>Pasang Kutu Emas di skrin utama</b><br><span class="hint">Buka papan admin terus seperti aplikasi, tanpa mencari pautan.</span></p>
      <div class="row-btns"><button class="btn small gold" data-install type="button">Pasang aplikasi</button>${later}</div>`;
  } else if (isIOS() && inAppBrowser()) {
    html = `<p><b>Mahu pasang Kutu Emas di skrin utama?</b><br><span class="hint">Buka halaman ini dalam Safari dahulu. Salin pautan, kemudian tampal dalam Safari.</span></p>
      <div class="row-btns"><button class="btn small" data-copylink type="button">Salin pautan</button>${later}</div>`;
  } else if (isIOS()) {
    html = `<p><b>Pasang Kutu Emas di skrin utama</b></p>
      <ol class="ios-steps"><li>Tekan butang <b>Kongsi</b> <span class="share-ic" aria-hidden="true">⬆︎</span> di bawah skrin Safari</li><li>Pilih <b>Add to Home Screen</b> (Tambah ke Skrin Utama)</li><li>Tekan <b>Add</b></li></ol>
      <div class="row-btns">${later}</div>`;
  } else if (inAppBrowser()) {
    html = `<p><b>Mahu pasang Kutu Emas di skrin utama?</b><br><span class="hint">Buka halaman ini dalam Chrome dahulu (menu ⋮ → "Buka dalam Chrome").</span></p>
      <div class="row-btns"><button class="btn small" data-copylink type="button">Salin pautan</button>${later}</div>`;
  }
  box.innerHTML = html ? `<div class="install">${html}</div>` : '';

  box.querySelector('[data-install]')?.addEventListener('click', async () => {
    const e = deferred;
    deferred = null;
    e.prompt();
    await e.userChoice.catch(() => {});
    refreshCards();
  });
  box.querySelector('[data-later]')?.addEventListener('click', () => {
    store.set(DISMISS_KEY, Date.now() + 14 * 24 * 3600 * 1000);
    box.innerHTML = '';
  });
  box.querySelector('[data-copylink]')?.addEventListener('click', () => copy(location.origin + '/', 'Pautan disalin.'));
}
