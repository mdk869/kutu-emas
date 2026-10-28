import './style.css';
import { ICON, setActionBar } from './ui.js';
import { renderHome } from './views/home.js';
import { renderCreate } from './views/create.js';
import { initPwa } from './pwa.js';
import { renderAdmin } from './views/admin.js';
import { renderParticipant } from './views/participant.js';
import { renderGroup } from './views/group.js';
import { renderVerify } from './views/verify.js';
import { renderEdit } from './views/edit.js';

document.getElementById('logo').innerHTML = ICON.bar;
initPwa();

const app = document.getElementById('app');
let cleanup = null;

function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  setActionBar('');
  const h = location.hash.slice(1);
  window.scrollTo(0, 0);
  // Halaman admin vs peserta (gesaan pasang aplikasi hanya untuk admin).
  document.body.dataset.view = /^(k=|p=)/.test(h) ? 'peserta' : 'admin';
  if (h.startsWith('a=')) cleanup = renderAdmin(app, h.slice(2));
  else if (h.startsWith('edit=')) cleanup = renderEdit(app, h.slice(5));
  else if (h.startsWith('p=')) cleanup = renderParticipant(app, h.slice(2));
  else if (h.startsWith('k=')) cleanup = renderGroup(app, h.slice(2));
  else if (h.startsWith('semak')) cleanup = renderVerify(app);
  else if (h === 'baru') cleanup = renderCreate(app);
  else cleanup = renderHome(app);
}

addEventListener('hashchange', route);
route();
