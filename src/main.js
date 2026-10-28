import './style.css';
import { ICON, setActionBar } from './ui.js';
import { renderCreate } from './views/create.js';
import { renderAdmin } from './views/admin.js';
import { renderParticipant } from './views/participant.js';
import { renderResults } from './views/results.js';
import { renderVerify } from './views/verify.js';

document.getElementById('logo').innerHTML = ICON.bar;

const app = document.getElementById('app');
let cleanup = null;

function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  setActionBar('');
  const h = location.hash.slice(1);
  window.scrollTo(0, 0);
  // Peserta & keputusan tidak perlu menu admin "Semakan lanjutan" di atas.
  document.body.dataset.view = h.slice(0, 2) || 'home';
  if (h.startsWith('a=')) cleanup = renderAdmin(app, h.slice(2));
  else if (h.startsWith('p=')) cleanup = renderParticipant(app, h.slice(2));
  else if (h.startsWith('k=')) cleanup = renderResults(app, h.slice(2));
  else if (h.startsWith('semak')) cleanup = renderVerify(app);
  else cleanup = renderCreate(app);
}

addEventListener('hashchange', route);
route();
