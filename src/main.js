import './style.css';
import { renderCreate } from './views/create.js';
import { renderAdmin } from './views/admin.js';
import { renderParticipant } from './views/participant.js';
import { renderVerify } from './views/verify.js';

const app = document.getElementById('app');
let cleanup = null;

function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  const h = location.hash.slice(1);
  window.scrollTo(0, 0);
  if (h.startsWith('a=')) cleanup = renderAdmin(app, h.slice(2));
  else if (h.startsWith('p=')) cleanup = renderParticipant(app, h.slice(2));
  else if (h.startsWith('semak')) cleanup = renderVerify(app);
  else cleanup = renderCreate(app);
}

addEventListener('hashchange', route);
route();
